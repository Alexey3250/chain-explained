"use client";

import { useCallback, useEffect, useState } from "react";
import { SlideShell } from "@/components/SlideShell";
import { Pill } from "@/components/ui";

const API = "https://mempool.space/api";
const SIZE = 100; // treemap coordinate space (square)

type Tile = { x: number; y: number; w: number; h: number; fee: number };
type Data = {
  count: number;
  vsizeMB: number;
  fastestFee: number;
  tiles: Tile[];
};

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
  const x = Math.max(1, f);
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
function squarify(
  data: { value: number; fee: number }[],
): Tile[] {
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

  const layout = (row: { area: number; fee: number }[]) => {
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
      layout(row);
      row = [item];
    }
  }
  if (row.length) layout(row);
  return out;
}

export default function Mempool() {
  const [data, setData] = useState<Data | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");

  const load = useCallback(async () => {
    try {
      const [mp, fees] = await Promise.all([
        fetch(`${API}/mempool`).then((r) => r.json()),
        fetch(`${API}/v1/fees/recommended`).then((r) => r.json()),
      ]);
      const hist: [number, number][] = mp.fee_histogram ?? [];
      // split big fee-bands into many capped tiles so it reads as a dense
      // mosaic (area stays proportional to block space)
      const totalV = hist.reduce((a, [, v]) => a + v, 0) || 1;
      const cap = totalV / 520;
      const items: { value: number; fee: number }[] = [];
      for (const [fee, vsize] of hist) {
        const n = Math.max(1, Math.min(120, Math.round(vsize / cap)));
        for (let k = 0; k < n; k++) items.push({ value: vsize / n, fee });
      }
      const tiles = squarify(items);
      setData({
        count: mp.count ?? 0,
        vsizeMB: (mp.vsize ?? 0) / 1_000_000,
        fastestFee: fees?.fastestFee ?? 0,
        tiles,
      });
      setState("ok");
    } catch {
      setState("error");
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    const id = setInterval(load, 6000);
    return () => clearInterval(id);
  }, [load]);

  return (
    <SlideShell
      kicker="the network · live"
      title="inside the mempool, right now"
      lede="every transaction waiting to be mined, drawn to scale. each tile is a band of transactions paying a similar fee — bigger means more block space, brighter means a higher fee. this is the live backlog."
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        {/* the treemap — the star */}
        <div className="mx-auto w-full max-w-[420px]">
          <div className="aspect-square w-full border border-border bg-[#0a0c10]">
            {data ? (
              <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="h-full w-full">
                {data.tiles.map((t, i) => (
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
                {state === "error" ? "network unreachable" : "connecting…"}
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
            {state === "ok" ? "live · bitcoin network" : state === "error" ? "offline" : "connecting…"}
          </Pill>

          <Stat label="transactions waiting" value={data ? data.count.toLocaleString() : "…"} />
          <Stat label="total backlog" value={data ? `${data.vsizeMB.toFixed(1)} vMB` : "…"} />
          <Stat
            label="to get in next block"
            value={data ? `~${data.fastestFee} sat/vB` : "…"}
          />

          <p className="font-mono text-[0.7rem] leading-relaxed text-muted">
            miners fill the next ~1 MB block from the top fees down. the green
            mass at the bottom may wait hours; the bright tiles get mined first.
          </p>
          <p className="font-mono text-[0.65rem] text-faint">
            mempool.space · refreshes every 6s
          </p>
        </div>
      </div>
    </SlideShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-border bg-bg-soft px-3 py-2">
      <div className="font-mono text-[0.6rem] uppercase tracking-widest text-faint">
        {label}
      </div>
      <div className="font-mono text-base font-semibold text-fg">{value}</div>
    </div>
  );
}
