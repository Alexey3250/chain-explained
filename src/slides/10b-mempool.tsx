"use client";

import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { SlideShell } from "@/components/SlideShell";
import { Pill } from "@/components/ui";

const REST = "https://mempool.space/api";
const WS = "wss://mempool.space/api/v1/ws";
const G = 64; // grid resolution (G x G cells) — small boxes
const UNIT = 300; // vBytes per grid cell (fixed scale: a normal tx ≈ 1 cell)
const MAXSIDE = 16; // clamp so one whale tx can't dominate
const MAX_TX = 2000; // cap for perf / grid capacity

type Tile = { txid: string; x: number; y: number; s: number; fee: number };
type Ghost = { key: string; x: number; y: number; s: number; fee: number };
type Tx = { vsize: number; rate: number; value?: number };
type Hover = { x: number; y: number; txid: string; fee: number; vsize?: number; value?: number };

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

/* ---- bottom-up gravity packing ----
   Tiles stack from the floor. `bottomY` is a tile's distance (in cells) from
   the bottom. New tiles fall into the lowest column that fits; when a tile
   leaves, a settle pass drops everything above straight down into the gap. */
type Placed = { x: number; bottomY: number; s: number; fee: number };

// lowest resting height across columns [x, x+s)
function restHeight(heights: number[], x: number, s: number): number {
  let m = 0;
  for (let k = 0; k < s; k++) if (heights[x + k] > m) m = heights[x + k];
  return m;
}

// drop every tile as low as it can go, keeping its column (x) fixed
function settle(place: Map<string, Placed>) {
  const arr = [...place.values()].sort((a, b) => a.bottomY - b.bottomY || a.x - b.x);
  const heights = new Array<number>(G).fill(0);
  for (const t of arr) {
    const rest = restHeight(heights, t.x, t.s);
    t.bottomY = rest;
    for (let k = 0; k < t.s; k++) heights[t.x + k] = rest + t.s;
  }
}

const cleanRate = (r: number) => (Number.isFinite(r) && r > 0 ? r : 1);

export default function Mempool() {
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [ghosts, setGhosts] = useState<Ghost[]>([]);
  const ghostN = useRef(0);
  const [drawn, setDrawn] = useState(0);
  const [hover, setHover] = useState<Hover | null>(null);
  const [stats, setStats] = useState<{ count: number; vsizeMB: number; fastestFee: number } | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");
  const [source, setSource] = useState<"transactions" | "fee bands">("transactions");

  const txs = useRef<Map<string, Tx>>(new Map());
  const placed = useRef<Map<string, Placed>>(new Map());

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
        /* non-critical */
      }
    };
    poll();
    const id = setInterval(poll, 10_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  /* live treemap: maintain stable tile positions, animate in/out */
  useEffect(() => {
    const map = txs.current;
    const place = placed.current;
    let ws: WebSocket | null = null;
    let closed = false;
    let gotData = false;

    // reconcile placed tiles against the current transaction set
    const sync = () => {
      // 1. transactions that left the mempool (mined / replaced) → fade out as ghosts
      const leaving: Ghost[] = [];
      for (const id of [...place.keys()]) {
        if (!map.has(id)) {
          const t = place.get(id)!;
          leaving.push({
            key: `${id}__g${ghostN.current++}`,
            x: t.x,
            y: G - (t.bottomY + t.s),
            s: t.s,
            fee: t.fee,
          });
          place.delete(id);
        }
      }
      if (leaving.length) {
        setGhosts((g) => [...g, ...leaving]);
        const keys = new Set(leaving.map((l) => l.key));
        setTimeout(() => setGhosts((g) => g.filter((x) => !keys.has(x.key))), 600);
      }

      // 2. current column heights from the tiles that remain
      const heights = new Array<number>(G).fill(0);
      for (const t of place.values())
        for (let k = 0; k < t.s; k++)
          heights[t.x + k] = Math.max(heights[t.x + k], t.bottomY + t.s);

      // 3. drop new transactions (highest fee first) into the lowest column that fits
      const fresh: [string, Tx][] = [];
      for (const [id, v] of map)
        if (!place.has(id) && Number.isFinite(v.vsize) && v.vsize > 0) fresh.push([id, v]);
      fresh.sort((a, b) => b[1].rate - a[1].rate);
      for (const [id, v] of fresh) {
        const s = Math.max(1, Math.min(MAXSIDE, Math.round(Math.sqrt(v.vsize / UNIT))));
        let bestX = -1;
        let bestY = Infinity;
        for (let x = 0; x + s <= G; x++) {
          const rest = restHeight(heights, x, s);
          if (rest < bestY) {
            bestY = rest;
            bestX = x;
          }
        }
        if (bestX < 0 || bestY + s > G) continue; // stack is full
        for (let k = 0; k < s; k++) heights[bestX + k] = bestY + s;
        place.set(id, { x: bestX, bottomY: bestY, s, fee: v.rate });
      }

      // 4. gravity: everything falls straight down into any freed space
      settle(place);

      setTiles(
        [...place.entries()].map(([id, t]) => ({
          txid: id,
          x: t.x,
          y: G - (t.bottomY + t.s),
          s: t.s,
          fee: t.fee,
        })),
      );
      setDrawn(place.size);
    };

    const onMsg = (e: MessageEvent) => {
      let d: Record<string, unknown>;
      try {
        d = JSON.parse(e.data);
      } catch {
        return;
      }
      const light = d.transactions as Array<{ txid: string; vsize: number; rate?: number; fee?: number; value?: number }> | undefined;
      if (Array.isArray(light))
        for (const t of light)
          if (Number.isFinite(t.vsize) && t.vsize > 0)
            map.set(t.txid, { vsize: t.vsize, rate: cleanRate(t.rate ?? (t.fee ?? 0) / t.vsize), value: t.value });

      const mt = d["mempool-transactions"] as
        | { added?: Array<{ txid: string; vsize?: number; weight?: number; fee?: number; rate?: number; value?: number; vout?: Array<{ value?: number }> }>; removed?: unknown[]; mined?: unknown[]; replaced?: unknown[] }
        | undefined;
      if (mt) {
        if (Array.isArray(mt.added))
          for (const t of mt.added) {
            const vsize = t.vsize ?? (t.weight ? t.weight / 4 : 0);
            if (Number.isFinite(vsize) && vsize > 0) {
              const value =
                t.value ??
                (Array.isArray(t.vout) ? t.vout.reduce((a, o) => a + (o.value ?? 0), 0) : undefined);
              map.set(t.txid, { vsize, rate: cleanRate(t.rate ?? (t.fee ?? 0) / vsize), value });
            }
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
      sync();
      setSource("transactions");
      setState("ok");
    }, 1200);

    // fallback to REST fee-bands if the socket never delivers
    const fallback = setTimeout(async () => {
      if (gotData) return;
      try {
        const mp = await fetch(`${REST}/mempool`).then((r) => r.json());
        const hist: [number, number][] = mp.fee_histogram ?? [];
        const totalV = hist.reduce((a, [, v]) => a + v, 0) || 1;
        const cap = totalV / 900;
        for (let i = 0; i < hist.length; i++) {
          const [fee, vsize] = hist[i];
          const n = Math.max(1, Math.min(120, Math.round(vsize / cap)));
          for (let k = 0; k < n; k++) map.set(`b${i}_${k}`, { vsize: vsize / n, rate: fee });
        }
        sync();
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
      lede="every square is a real transaction waiting to be mined — sized by its weight in vBytes, coloured by its fee. they drop in as they arrive and vanish the instant a miner sweeps them into a block. streaming live."
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        {/* the live, animated grid */}
        <div className="mx-auto w-full max-w-[420px]">
          <div className="aspect-square w-full overflow-hidden border border-border bg-[#0a0c10]">
            {tiles.length > 0 ? (
              <svg viewBox={`0 0 ${G} ${G}`} className="h-full w-full">
                {/* active transactions — drop in from the top */}
                <g>
                {tiles.map((t) => {
                  const real = t.txid.length === 64;
                  return (
                    <motion.rect
                      key={t.txid}
                      initial={{ opacity: 0, x: t.x + 0.1, y: -(t.s + 2), width: t.s - 0.2, height: t.s - 0.2 }}
                      animate={{ opacity: 1, x: t.x + 0.1, y: t.y + 0.1, width: t.s - 0.2, height: t.s - 0.2 }}
                      transition={{ duration: 0.45, ease: "easeOut" }}
                      style={{ fill: feeToColor(t.fee), cursor: real ? "pointer" : "default" }}
                      onMouseEnter={(e) => {
                        const info = txs.current.get(t.txid);
                        setHover({ x: e.clientX, y: e.clientY, txid: t.txid, fee: t.fee, vsize: info?.vsize, value: info?.value });
                      }}
                      onMouseMove={(e) => setHover((h) => (h && h.txid === t.txid ? { ...h, x: e.clientX, y: e.clientY } : h))}
                      onMouseLeave={() => setHover((h) => (h && h.txid === t.txid ? null : h))}
                      onClick={() => real && window.open(`https://mempool.space/tx/${t.txid}`, "_blank", "noopener")}
                    />
                  );
                })}
                </g>
                {/* departing transactions — fade + shrink out when mined */}
                <g>
                {ghosts.map((g) => (
                  <motion.rect
                    key={g.key}
                    initial={{ opacity: 1, x: g.x + 0.1, y: g.y + 0.1, width: g.s - 0.2, height: g.s - 0.2 }}
                    animate={{ opacity: 0, scale: 0.3 }}
                    transition={{ duration: 0.5, ease: "easeIn" }}
                    style={{ fill: feeToColor(g.fee), transformBox: "fill-box", transformOrigin: "center" }}
                  />
                ))}
                </g>
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
            watch a square pop in when a transaction is broadcast, and disappear
            the moment it gets mined. big square = heavy tx; bright = high fee.
          </p>
          <p className="font-mono text-[0.65rem] text-faint">
            mempool.space ws · sized by vBytes
          </p>
        </div>
      </div>

      {hover && <TxTooltip hover={hover} />}
    </SlideShell>
  );
}

function TxTooltip({ hover }: { hover: Hover }) {
  const real = hover.txid.length === 64;
  const vw = typeof window !== "undefined" ? window.innerWidth : 9999;
  const left = Math.min(hover.x + 14, vw - 224);
  return (
    <div
      className="pointer-events-none fixed z-50 w-[210px] border border-accent/60 bg-bg p-2.5 font-mono text-[0.7rem]"
      style={{ left, top: hover.y + 14 }}
    >
      <div className="text-faint">{real ? "transaction" : "fee band"}</div>
      {real && (
        <div className="mt-0.5 break-all text-blue">
          {hover.txid.slice(0, 16)}…{hover.txid.slice(-6)}
        </div>
      )}
      <div className="mt-1.5 flex justify-between gap-3">
        <span className="text-faint">fee</span>
        <span style={{ color: feeToColor(hover.fee) }}>{Math.round(hover.fee)} sat/vB</span>
      </div>
      <div className="flex justify-between gap-3">
        <span className="text-faint">size</span>
        <span className="text-fg">{hover.vsize != null ? Math.round(hover.vsize).toLocaleString() : "—"} vB</span>
      </div>
      <div className="flex justify-between gap-3">
        <span className="text-faint">value</span>
        <span className="text-fg">
          {hover.value != null
            ? (hover.value / 1e8).toLocaleString(undefined, { maximumFractionDigits: 4 })
            : "—"}{" "}
          BTC
        </span>
      </div>
      {real && <div className="mt-1.5 text-faint">click → mempool.space</div>}
    </div>
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
