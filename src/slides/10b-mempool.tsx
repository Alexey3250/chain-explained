"use client";

import { useEffect, useRef, useState } from "react";
import { SlideShell } from "@/components/SlideShell";
import { Pill } from "@/components/ui";

const REST = "https://mempool.space/api";
const WS = "wss://mempool.space/api/v1/ws";
const SIZE = 100; // treemap coordinate space (square)
const MAX_TX = 1200; // cap tiles for perf

type Tile = { x: number; y: number; w: number; h: number; fee: number };
type Tx = { vsize: number; rate: number };

/* ---- fee → colour (log scale, green → amber → red) ---- */
const STOPS: [number, [number, number, number]][] = [
  [1, [27, 94, 75]],
  [3, [46, 125, 80]],
  [8, [124, 170, 60]],
  [20, [205, 185, 52]],
  [50, [247, 147, 26]],
  [150, [229, 103, 95]],
];
const rgb = (c: number[]) => `rgb(${c[0]},${c[1]},${c[2]})`;
function feeToColor(f: number): string {
  const x = Number.isFinite(f) && f > 0 ? f : 1;
  if (x <= STOPS[0][0]) return rgb(STOPS[0][1]);
  for (let i = 1; i < STOPS.length; i++) {
    if (x <= STOPS[i][0]) {
      const [f0, c0] = STOPS[i - 1];
      const [f1, c1] = STOPS[i];
      const t = (Math.log(x) - Math.log(f0)) / (Math.log(f1) - Math.log(f0));
      return rgb(c0.map((c, k) => Math.round(c + (c1[k] - c) * t)));
    }
  }
  return rgb(STOPS[STOPS.length - 1][1]);
}

/* ---- squarified treemap (Bruls/Huizing/van Wijk) ---- */
function squarify(data: { value: number; fee: number }[]): Tile[] {
  const total = data.reduce((a, d) => a + d.value, 0) || 1;
  const scale = (SIZE * SIZE) / total;
  const items = data
    .map((d) => ({ area: d.value * scale, fee: d.fee }))
    .sort((a, b) => b.area - a.area);

  const out: Tile[] = [];
  const rect = { x: 0, y: 0, w: SIZE, h: SIZE };

  const worst = (row: { area: number }[], side: number) => {
    const sum = row.reduce((a, r) => a + r.area, 0);
    const max = Math.max(...row.map((r) => r.area));
    const min = Math.min(...row.map((r) => r.area));
    const s2 = sum * sum;
    const l2 = side * side;
    return Math.max((l2 * max) / s2, s2 / (l2 * min));
  };

  const place = (row: { area: number; fee: number }[]) => {
    const sum = row.reduce((a, r) => a + r.area, 0);
    if (rect.w >= rect.h) {
      const colW = sum / rect.h;
      let cy = rect.y;
      for (const r of row) {
        const rh = r.area / colW;
        out.push({ x: rect.x, y: cy, w: colW, h: rh, fee: r.fee });
        cy += rh;
      }
      rect.x += colW;
      rect.w -= colW;
    } else {
      const rowH = sum / rect.w;
      let cx = rect.x;
      for (const r of row) {
        const rw = r.area / rowH;
        out.push({ x: cx, y: rect.y, w: rw, h: rowH, fee: r.fee });
        cx += rw;
      }
      rect.y += rowH;
      rect.h -= rowH;
    }
  };

  let row: { area: number; fee: number }[] = [];
  for (const item of items) {
    const side = Math.min(rect.w, rect.h);
    if (row.length === 0 || worst([...row, item], side) <= worst(row, side)) {
      row.push(item);
    } else {
      place(row);
      row = [item];
    }
  }
  if (row.length) place(row);
  return out;
}

const cleanRate = (r: number) => (Number.isFinite(r) && r > 0 ? r : 1);

export default function Mempool() {
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [drawn, setDrawn] = useState(0);
  const [stats, setStats] = useState<{ count: number; vsizeMB: number; fastestFee: number } | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");
  const [source, setSource] = useState<"transactions" | "fee bands">("transactions");

  const txs = useRef<Map<string, Tx>>(new Map());

  /* headline stats from REST, polled */
  useEffect(() => {
    let alive = true;
    const poll = async () => {
      try {
        const [mp, fees] = await Promise.all([
          fetch(`${REST}/mempool`).then((r) => r.json()),
          fetch(`${REST}/v1/fees/recommended`).then((r) => r.json()),
        ]);
        if (alive)
          setStats({
            count: mp.count ?? 0,
            vsizeMB: (mp.vsize ?? 0) / 1_000_000,
            fastestFee: fees?.fastestFee ?? 0,
          });
      } catch {
        /* stats are non-critical */
      }
    };
    poll();
    const id = setInterval(poll, 10_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  /* live per-transaction treemap from the WebSocket */
  useEffect(() => {
    const map = txs.current;
    let ws: WebSocket | null = null;
    let closed = false;
    let gotData = false;

    const onMsg = (e: MessageEvent) => {
      let d: Record<string, unknown>;
      try {
        d = JSON.parse(e.data);
      } catch {
        return;
      }
      const light = d.transactions as Array<{ txid: string; vsize: number; rate?: number; fee?: number }> | undefined;
      if (Array.isArray(light))
        for (const t of light)
          if (t.vsize) map.set(t.txid, { vsize: t.vsize, rate: cleanRate(t.rate ?? (t.fee ?? 0) / t.vsize) });

      const mt = d["mempool-transactions"] as
        | { added?: Array<{ txid: string; vsize?: number; weight?: number; fee?: number; rate?: number }>; removed?: unknown[]; mined?: unknown[]; replaced?: unknown[] }
        | undefined;
      if (mt) {
        if (Array.isArray(mt.added))
          for (const t of mt.added) {
            const vsize = t.vsize ?? (t.weight ? t.weight / 4 : 0);
            if (vsize) map.set(t.txid, { vsize, rate: cleanRate(t.rate ?? (t.fee ?? 0) / vsize) });
          }
        for (const key of ["removed", "mined", "replaced"] as const) {
          const arr = mt[key];
          if (Array.isArray(arr))
            for (const x of arr) {
              const id = typeof x === "string" ? x : (x as { txid?: string })?.txid;
              if (id) map.delete(id);
            }
        }
      }
      while (map.size > MAX_TX) map.delete(map.keys().next().value as string);
      gotData = true;
    };

    const connect = () => {
      try {
        ws = new WebSocket(WS);
      } catch {
        return;
      }
      ws.onopen = () => ws?.send(JSON.stringify({ "track-mempool": true }));
      ws.onmessage = onMsg;
      ws.onclose = () => {
        if (!closed) setTimeout(connect, 3000);
      };
    };
    connect();

    const rebuild = setInterval(() => {
      if (map.size === 0) return;
      const items = [...map.values()].map((t) => ({ value: t.vsize, fee: t.rate }));
      setTiles(squarify(items));
      setDrawn(map.size);
      setSource("transactions");
      setState("ok");
    }, 1500);

    // fallback to REST fee-bands if the socket never delivers
    const fallback = setTimeout(async () => {
      if (gotData) return;
      try {
        const mp = await fetch(`${REST}/mempool`).then((r) => r.json());
        const hist: [number, number][] = mp.fee_histogram ?? [];
        const totalV = hist.reduce((a, [, v]) => a + v, 0) || 1;
        const cap = totalV / 520;
        const items: { value: number; fee: number }[] = [];
        for (const [fee, vsize] of hist) {
          const n = Math.max(1, Math.min(120, Math.round(vsize / cap)));
          for (let k = 0; k < n; k++) items.push({ value: vsize / n, fee });
        }
        setTiles(squarify(items));
        setSource("fee bands");
        setState("ok");
      } catch {
        setState("error");
      }
    }, 9000);

    return () => {
      closed = true;
      clearInterval(rebuild);
      clearTimeout(fallback);
      try {
        ws?.close();
      } catch {
        /* noop */
      }
    };
  }, []);

  return (
    <SlideShell
      kicker="the network · live"
      title="inside the mempool, right now"
      lede="every tile is a real transaction waiting to be mined — sized by its weight in vBytes and coloured by the fee it pays. miners take the brightest tiles first. this is streaming live from the bitcoin network."
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        {/* the live treemap */}
        <div className="mx-auto w-full max-w-[420px]">
          <div className="aspect-square w-full border border-border bg-[#0a0c10]">
            {tiles.length > 0 ? (
              <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="h-full w-full">
                {tiles.map((t, i) => (
                  <rect
                    key={i}
                    x={t.x}
                    y={t.y}
                    width={t.w}
                    height={t.h}
                    stroke="#0a0c10"
                    strokeWidth={0.12}
                    style={{ fill: feeToColor(t.fee), transition: "fill 0.6s ease-out" }}
                  />
                ))}
              </svg>
            ) : (
              <div className="flex h-full items-center justify-center font-mono text-xs text-faint">
                {state === "error" ? "network unreachable" : "listening to the network…"}
              </div>
            )}
          </div>

          {/* fee colour legend */}
          <div className="mt-2">
            <div
              className="h-2 w-full"
              style={{
                background:
                  "linear-gradient(90deg, rgb(27,94,75), rgb(46,125,80), rgb(124,170,60), rgb(205,185,52), rgb(247,147,26), rgb(229,103,95))",
              }}
            />
            <div className="mt-1 flex justify-between font-mono text-[0.6rem] text-faint">
              <span>1 sat/vB</span>
              <span>low fee → high fee</span>
              <span>150+</span>
            </div>
          </div>
        </div>

        {/* live stats + reading guide */}
        <div className="flex flex-col gap-3 lg:w-64">
          <Pill tone={state === "ok" ? "green" : state === "error" ? "red" : "accent"}>
            <span
              className={`inline-block h-2 w-2 ${
                state === "ok" ? "animate-pulse bg-green" : state === "error" ? "bg-red" : "bg-accent"
              }`}
            />
            {state === "ok" ? `live · ${source}` : state === "error" ? "offline" : "connecting…"}
          </Pill>

          <Stat label="transactions waiting" value={stats ? stats.count.toLocaleString() : "…"} />
          <Stat label="total backlog" value={stats ? `${stats.vsizeMB.toFixed(1)} vMB` : "…"} />
          <Stat label="to get in next block" value={stats ? `~${stats.fastestFee} sat/vB` : "…"} />
          <Stat label="drawn here" value={drawn ? `${drawn.toLocaleString()} txs` : "…"} />

          <p className="font-mono text-[0.7rem] leading-relaxed text-muted">
            a big tile is a heavy transaction that eats more block space. the
            bright ones pay top fees and get mined first; the dim green ones may
            wait.
          </p>
          <p className="font-mono text-[0.65rem] text-faint">
            mempool.space ws · sized by vBytes
          </p>
        </div>
      </div>
    </SlideShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-border bg-bg-soft px-3 py-2">
      <div className="font-mono text-[0.6rem] uppercase tracking-widest text-faint">{label}</div>
      <div className="font-mono text-base font-semibold text-fg">{value}</div>
    </div>
  );
}
