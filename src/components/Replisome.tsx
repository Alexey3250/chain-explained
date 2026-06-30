"use client";

import { motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { feeToColor } from "@/lib/fee";

/* =====================================================================
   The Replisome — Bitcoin's ledger copied like DNA, rendered as a living
   Game-of-Life machine. A Canvas "mempool soup" cellular automaton runs
   underneath an SVG replisome (sealed double-strand ledger → fork/helicase
   at the chain tip → polymerase "miners" building blocks → ligase welds =
   prev-hash links). Hover any part to inspect what it is.
   ===================================================================== */

const COLS = 96;
const ROWS = 40;
const CELL = 8; // canvas px per cell
const STATION = 60; // x of the replication fork
const PITCH = 5; // block-to-block spacing
const BLK = 4; // block size (cells)
const TOP_BACK = 16; // top backbone row
const BOT_BACK = 24; // bottom backbone row
const MID = 20;

type Region =
  | "ledger"
  | "copies"
  | "leading"
  | "lagging"
  | "fork"
  | "polymerase"
  | "ligase"
  | "soup";

const MAP: Record<Region, { dna: string; btc: string; title: string; body: string }> = {
  ledger: {
    dna: "Parental double helix",
    btc: "The blockchain ledger",
    title: "the ledger",
    body: "Each block is one rung of a long double strand — the agreed history. The machine only ever copies it forward; it can never edit what's already written.",
  },
  copies: {
    dna: "Semiconservative copying",
    btc: "Every node holds a full copy",
    title: "every node, a full copy",
    body: "Each new double-strand keeps one original strand and builds a fresh one beside it — the whole sequence preserved in every copy. Likewise there's no master server: every node carries the entire ledger, so it survives even if most vanish.",
  },
  leading: {
    dna: "Leading strand",
    btc: "The main chain extending",
    title: "the main chain",
    body: "The new strand is copied in one direction along the template — like the single chain, always extended at its tip, one block at a time.",
  },
  lagging: {
    dna: "Lagging strand · Okazaki fragments",
    btc: "Blocks mined as discrete chunks",
    title: "discrete blocks",
    body: "The other strand can't be made continuously, so it's built as separate fragments. Each fragment is one mined block — a self-contained chunk stitched in afterward.",
  },
  fork: {
    dna: "Replication fork + helicase",
    btc: "The chain tip · proof-of-work",
    title: "the chain tip",
    body: "The fork is the live edge where the next block attaches. The helicase wedge is proof-of-work — the costly motor that pries the tip open and drives it forward, one block at a time.",
  },
  polymerase: {
    dna: "DNA polymerase",
    btc: "Miners",
    title: "the miners",
    body: "Polymerase reads the template and writes the new strand base by base. Miners do the same: read pending transactions and write the next block onto the tip.",
  },
  ligase: {
    dna: "Ligase",
    btc: "prev-block-hash link",
    title: "the prev-hash weld",
    body: "Ligase welds each new block to the one before it. The prev-block-hash is that weld — and because it's computed from the previous block's contents, changing any old block breaks every link after it. That's what makes the chain tamper-evident.",
  },
  soup: {
    dna: "Free nucleotide pool",
    btc: "The mempool",
    title: "the mempool",
    body: "A living soup of free bases drifting around the fork: unconfirmed transactions waiting to be pulled into a block. A birth is a new broadcast; a death is a tx mined or dropped.",
  },
};

// render order: bigger zones first, smaller specific ones on top
const REGION_ORDER: Region[] = ["soup", "copies", "leading", "lagging", "ledger", "polymerase", "fork", "ligase"];

type Block = { id: number; fee: number };

const idx = (x: number, y: number) => y * COLS + x;
const inGrid = (x: number, y: number) => x >= 0 && x < COLS && y >= 0 && y < ROWS;
// soup lives ahead of the fork (the nucleotide pool around the active site)
const soupZone = (x: number) => x >= STATION + 4;

export default function Replisome({ mode }: { mode: "intro" | "outro" }) {
  const intro = mode === "intro";
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [hovered, setHovered] = useState<Region | null>(null);
  const [tour, setTour] = useState<Region | null>(intro ? null : "soup");
  const [minted, setMinted] = useState(intro ? 6 : 11);
  const [reduced, setReduced] = useState(false);

  const idRef = useRef(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const visibleRef = useRef(true);

  const newBlock = (): Block => ({ id: idRef.current++, fee: Math.random() ** 2 * (intro ? 40 : 130) + 1 });

  // seed an initial chain
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBlocks(Array.from({ length: intro ? 5 : 11 }, () => newBlock()));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // reduced-motion (live — tracks runtime toggles)
  useEffect(() => {
    const m = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setReduced(m.matches);
    on();
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);

  // pause work when the slide isn't on screen
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const io = new IntersectionObserver((e) => (visibleRef.current = e[0].isIntersecting), { threshold: 0.05 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // block cycle: mint a new block, scroll the chain left
  useEffect(() => {
    if (reduced) return;
    const id = setInterval(() => {
      if (!visibleRef.current) return;
      setBlocks((prev) => [newBlock(), ...prev].slice(0, 11));
      setMinted((m) => m + 1);
    }, intro ? 2600 : 1500);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced, intro]);

  // outro auto-tour: cycle the inspector through parts until the user hovers
  useEffect(() => {
    if (intro || reduced) return;
    let i = 0;
    const id = setInterval(() => {
      i = (i + 1) % REGION_ORDER.length;
      setTour(REGION_ORDER[i]);
    }, 3600);
    return () => clearInterval(id);
  }, [intro, reduced]);

  // the Game-of-Life soup (Canvas)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const life = new Uint8Array(COLS * ROWS);
    const next = new Uint8Array(COLS * ROWS);
    const fee = new Float32Array(COLS * ROWS);

    const randFee = () => Math.random() ** 2 * (intro ? 30 : 120) + 1;
    const seed = (n: number) => {
      for (let k = 0; k < n; k++) {
        const x = STATION + 4 + Math.floor(Math.random() * (COLS - STATION - 4));
        const y = Math.floor(Math.random() * ROWS);
        life[idx(x, y)] = 1;
        fee[idx(x, y)] = randFee();
      }
    };
    seed(intro ? 90 : 220);

    const step = () => {
      for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
          if (!soupZone(x)) {
            next[idx(x, y)] = 0;
            continue;
          }
          let n = 0;
          let fsum = 0;
          for (let dy = -1; dy <= 1; dy++)
            for (let dx = -1; dx <= 1; dx++) {
              if (!dx && !dy) continue;
              const nx = x + dx;
              const ny = y + dy;
              if (inGrid(nx, ny) && life[idx(nx, ny)]) {
                n++;
                fsum += fee[idx(nx, ny)];
              }
            }
          const alive = life[idx(x, y)];
          if (alive && (n === 2 || n === 3)) {
            next[idx(x, y)] = 1;
          } else if (!alive && n === 3) {
            next[idx(x, y)] = 1;
            fee[idx(x, y)] = fsum / 3;
          } else {
            next[idx(x, y)] = 0;
          }
        }
      }
      life.set(next);
    };

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
          if (life[idx(x, y)]) {
            ctx.fillStyle = feeToColor(fee[idx(x, y)]);
            ctx.fillRect(x * CELL, y * CELL, CELL - 1, CELL - 1);
          }
        }
      }
    };

    let raf = 0;
    let last = 0;
    let acc = 0;
    let sinceSeed = 0;
    const tickMs = intro ? 150 : 110;

    if (reduced) {
      for (let i = 0; i < 14; i++) step();
      draw();
      return;
    }

    const loop = (t: number) => {
      raf = requestAnimationFrame(loop);
      if (!visibleRef.current) {
        last = t;
        return;
      }
      if (!last) last = t;
      acc += t - last;
      last = t;
      if (acc >= tickMs) {
        acc = 0;
        sinceSeed += 1;
        step();
        if (sinceSeed >= (intro ? 6 : 3)) {
          sinceSeed = 0;
          seed(intro ? 14 : 34); // keep the soup churning
        }
        draw();
      }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [reduced, intro]);

  const eff: Region | null = hovered ?? (intro ? null : tour);
  const dim = (r: Region) => (eff && eff !== r ? 0.22 : 1);

  const blockX = (i: number) => STATION - (i + 1) * PITCH;
  const visibleBlocks = useMemo(() => blocks.filter((_, i) => blockX(i) >= 1), [blocks]);

  const info = eff ? MAP[eff] : null;

  return (
    <div ref={wrapRef} className="w-full" data-no-swipe>
      {/* the stage */}
      <div
        className="relative w-full overflow-hidden border border-border bg-bg"
        style={{ aspectRatio: `${COLS} / ${ROWS}` }}
      >
        <canvas
          ref={canvasRef}
          width={COLS * CELL}
          height={ROWS * CELL}
          className="absolute inset-0 h-full w-full"
          style={{
            imageRendering: "pixelated",
            opacity: eff && eff !== "soup" ? 0.3 : 1,
            transition: "opacity 0.25s",
          }}
          aria-hidden
        />

        <svg
          viewBox={`0 0 ${COLS} ${ROWS}`}
          className="absolute inset-0 h-full w-full"
          preserveAspectRatio="none"
          role="img"
          aria-label="A DNA-replication machine copying the Bitcoin ledger — hover or focus its parts to inspect them."
        >
          {/* ---- decorative machine (no pointer events) ---- */}
          <g style={{ pointerEvents: "none" }}>
            {/* sealed double-strand backbones (the copies on every node) */}
            <g style={{ opacity: dim("copies") }}>
              <rect x={1} y={TOP_BACK} width={STATION - 1} height={0.5} fill="var(--faint)" />
              <rect x={1} y={BOT_BACK} width={STATION - 1} height={0.5} fill="var(--faint)" />
            </g>

            {/* unwound template arms peeling into the soup */}
            <g style={{ opacity: dim("fork") }}>
              <line x1={STATION} y1={TOP_BACK} x2={COLS} y2={9} stroke="var(--faint)" strokeWidth={0.4} strokeDasharray="1 1" />
              <line x1={STATION} y1={BOT_BACK} x2={COLS} y2={ROWS - 9} stroke="var(--faint)" strokeWidth={0.4} strokeDasharray="1 1" />
            </g>

            {/* rungs + blocks (the ledger) */}
            <g style={{ opacity: dim("ledger") }}>
              {visibleBlocks.map((b, i) => {
                const x = blockX(i);
                return (
                  <g key={`rung-${b.id}`}>
                    <rect x={x + BLK / 2 - 0.15} y={TOP_BACK} width={0.3} height={BOT_BACK - TOP_BACK} fill="var(--border)" />
                  </g>
                );
              })}
            </g>
            <g>
              {visibleBlocks.map((b, i) => {
                const x = blockX(i);
                const isNew = i === 0;
                return (
                  <motion.rect
                    key={b.id}
                    initial={isNew ? { opacity: 0 } : false}
                    animate={{ opacity: dim("ledger"), x: x }}
                    transition={{ duration: 0.55, ease: "easeOut" }}
                    y={MID - BLK / 2}
                    width={BLK}
                    height={BLK}
                    fill={feeToColor(b.fee)}
                    stroke="var(--bg)"
                    strokeWidth={0.4}
                  />
                );
              })}
            </g>

            {/* ligase weld joining newest block to the chain */}
            <rect x={STATION - PITCH - 1} y={MID - BLK / 2} width={0.9} height={BLK} fill="var(--accent)" style={{ opacity: dim("ligase") }} />

            {/* polymerase heads (miners) */}
            <g style={{ opacity: dim("polymerase") }}>
              <rect x={STATION - 5} y={TOP_BACK - 1} width={4} height={4} fill="var(--green)" />
              <rect x={STATION - 5} y={BOT_BACK - 3} width={4} height={4} fill="var(--green)" />
              {/* primer seed */}
              <rect x={STATION - 6} y={BOT_BACK - 1} width={1} height={2} fill="var(--blue)" />
            </g>

            {/* helicase wedge (chain tip / proof-of-work) */}
            <polygon
              points={`${STATION},${TOP_BACK} ${STATION + 4},${MID} ${STATION},${BOT_BACK}`}
              fill="var(--accent)"
              style={{ opacity: dim("fork") }}
            />
          </g>

          {/* ---- transparent hover/focus hit-regions (on top) ---- */}
          <g role="group" aria-label="Inspect the replication machine">
            {/* background catches taps on empty space to clear the inspector */}
            <rect
              x={0}
              y={0}
              width={COLS}
              height={ROWS}
              fill="transparent"
              onClick={() => setHovered(null)}
            />
            <HitRect r="soup" x={STATION + 4} y={0} w={COLS - STATION - 4} h={ROWS} set={setHovered} />
            <HitRect r="copies" x={0} y={TOP_BACK - 1} w={4} h={BOT_BACK - TOP_BACK + 2} set={setHovered} />
            <HitRect r="leading" x={4} y={TOP_BACK - 1.5} w={STATION - 9} h={3} set={setHovered} />
            <HitRect r="lagging" x={4} y={BOT_BACK - 1.5} w={STATION - 9} h={3} set={setHovered} />
            <HitRect r="ledger" x={4} y={MID - 3} w={STATION - 11} h={6} set={setHovered} />
            <HitRect r="polymerase" x={STATION - 6} y={TOP_BACK - 2} w={5} h={BOT_BACK - TOP_BACK + 4} set={setHovered} />
            <HitRect r="fork" x={STATION - 0.5} y={TOP_BACK - 1} w={4.5} h={BOT_BACK - TOP_BACK + 2} set={setHovered} />
            {/* ligase last so it wins over polymerase, aligned to its weld */}
            <HitRect r="ligase" x={STATION - PITCH - 1.5} y={MID - 3} w={3} h={6} set={setHovered} />
          </g>
        </svg>

        {/* corner readout */}
        <div className="pointer-events-none absolute right-2 top-2 font-mono text-[0.65rem] text-muted">
          {intro ? "replisome · idling" : `blocks copied · ${minted.toLocaleString()}`}
        </div>
      </div>

      {/* inspector */}
      <div
        className="mt-2 border border-border bg-panel/60 p-3 text-left font-mono"
        aria-live="polite"
        aria-atomic="true"
      >
        {info ? (
          <div>
            <div className="text-[0.7rem] tracking-wide text-accent">{`// ${info.title}`}</div>
            <div className="mt-1 flex flex-wrap items-baseline gap-x-2 text-xs">
              <span className="text-muted">{info.dna}</span>
              <span className="text-faint">→</span>
              <span className="font-semibold text-accent">{info.btc}</span>
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-muted">{info.body}</p>
          </div>
        ) : (
          <div className="text-xs text-muted">
            {`// inspect`} · tap or hover any part of the machine to see what it
            really is <span className="text-accent blink">█</span>
          </div>
        )}
      </div>
    </div>
  );
}

function HitRect({
  r,
  x,
  y,
  w,
  h,
  set,
}: {
  r: Region;
  x: number;
  y: number;
  w: number;
  h: number;
  set: (r: Region | null) => void;
}) {
  return (
    <rect
      x={x}
      y={y}
      width={w}
      height={h}
      fill="transparent"
      tabIndex={0}
      role="button"
      aria-label={MAP[r].btc}
      style={{ cursor: "pointer", outline: "none" }}
      onMouseEnter={() => set(r)}
      onMouseLeave={() => set(null)}
      onFocus={() => set(r)}
      onBlur={() => set(null)}
      onClick={() => set(r)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          set(r);
        }
      }}
    />
  );
}
