"use client";

import { useEffect, useRef, useState } from "react";
import { feeToColor } from "@/lib/fee";

/* =====================================================================
   The Bitcoin lifecycle, in pixels (one pixel ≈ one transaction):
   transactions drift in and gather in the MEMPOOL → NODE robots fly
   around validating them → a MINER packs the highest-fee ones into a
   BLOCK → the block links onto the CHAIN, which scrolls off-screen as
   history. Reuses the mempool's fee-colour pixel style.
   ===================================================================== */

const CW = 460; // canvas internal width (device px, scaled by CSS)
const CH = 188;
const TX = 3; // one transaction = one little pixel
const BN = 7; // block is BN×BN transactions
const BLOCK = BN * TX + 4; // block square incl. frame
const LINK = 11; // chain-link width between blocks
const PITCH = BLOCK + LINK;

const ASSEM_X = 206; // where a block is assembled
const ASSEM_Y = 96;
const CHAIN_RIGHT = 168; // x of the newest attached block
const MEM_X0 = 250; // mempool pile left edge
const MEM_Y0 = 78; // mempool pile top
const NODE_Y1 = 70; // node airspace bottom

type Region = "chain" | "link" | "block" | "miner" | "mempool" | "nodes";

const MAP: Record<Region, { title: string; term: string; body: string }> = {
  mempool: {
    title: "the mempool",
    term: "unconfirmed transactions",
    body: "Every payment is broadcast to the network and waits here as one pixel until a miner picks it up. Warmer colours pay a higher fee and get chosen first.",
  },
  nodes: {
    title: "the nodes",
    term: "the validators / relayers",
    body: "Thousands of independent computers relay each transaction and re-check every rule themselves — valid signature, unspent coins, correct amounts. No one is in charge; cheats are simply ignored.",
  },
  miner: {
    title: "the miner",
    term: "assembling + proof-of-work",
    body: "A miner gathers transactions from the mempool into a candidate block, then burns energy guessing hashes until it finds proof-of-work — the costly lottery that earns the right to add the block.",
  },
  block: {
    title: "a block",
    term: "a batch of transactions",
    body: "Each pixel here is one transaction, packed together into a single block — about one is sealed every ten minutes. Watch it fill, then snap onto the chain.",
  },
  chain: {
    title: "the blockchain",
    term: "the shared history",
    body: "Sealed blocks, oldest scrolling off into history. Every node keeps this same ordered record; once a block is buried under others it's effectively permanent.",
  },
  link: {
    title: "the link",
    term: "prev-block-hash",
    body: "Each block stores the hash of the block before it. That cryptographic link is what makes it a chain — edit any old block and every link after it breaks.",
  },
};

const REGION_ORDER: Region[] = ["mempool", "nodes", "miner", "block", "chain", "link"];

type Tx = {
  x: number;
  y: number;
  tx0: number; // target x
  ty0: number; // target y
  fee: number;
  phase: "in" | "pool" | "toblock";
  slot: number; // block slot when mining
  flash: number; // node-check flash timer
};
type Blk = { x: number; tx: number; pixels: number[]; height: number };
type Node = { x: number; y: number; vx: number; vy: number; t: number; target: number };

const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const randFee = (intro: boolean) => Math.random() ** 2 * (intro ? 40 : 130) + 1;

export default function ChainMachine({ mode }: { mode: "intro" | "outro" }) {
  const intro = mode === "intro";
  const [hovered, setHovered] = useState<Region | null>(null);
  const [tour, setTour] = useState<Region | null>(intro ? null : "mempool");
  const [minted, setMinted] = useState(intro ? 0 : 11);
  const [reduced, setReduced] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const visibleRef = useRef(true);
  const hoveredRef = useRef<Region | null>(null);
  useEffect(() => {
    hoveredRef.current = hovered;
  }, [hovered]);

  // reduced-motion (live)
  useEffect(() => {
    const m = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setReduced(m.matches);
    on();
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);

  // pause when off-screen
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const io = new IntersectionObserver((e) => (visibleRef.current = e[0].isIntersecting), { threshold: 0.05 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // outro auto-tour
  useEffect(() => {
    if (intro || reduced) return;
    let i = 0;
    const id = setInterval(() => {
      i = (i + 1) % REGION_ORDER.length;
      setTour(REGION_ORDER[i]);
    }, 4200);
    return () => clearInterval(id);
  }, [intro, reduced]);

  // the simulation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // mempool fill grid (bottom-up heap of pixels)
    const memCols = Math.floor((CW - MEM_X0 - 4) / (TX + 1));
    const memRows = Math.floor((CH - MEM_Y0 - 4) / (TX + 1));
    const memSlot = (i: number) => {
      const c = i % memCols;
      const r = Math.floor(i / memCols);
      return { x: MEM_X0 + c * (TX + 1), y: CH - 4 - (r + 1) * (TX + 1) };
    };
    const memCap = memCols * memRows;

    const txs: Tx[] = [];
    const blocks: Blk[] = [];
    const total = BN * BN;
    const forming: { fee: number; filled: boolean }[] = Array.from({ length: total }, () => ({ fee: 0, filled: false }));
    let formingActive = false;

    const nodes: Node[] = Array.from({ length: intro ? 3 : 4 }, () => ({
      x: rnd(MEM_X0 - 20, CW - 10),
      y: rnd(8, NODE_Y1),
      vx: rnd(-12, 12),
      vy: rnd(-8, 8),
      t: rnd(0, 2),
      target: -1,
    }));

    // seed an initial chain (history already present)
    const seedBlocks = intro ? 4 : 7;
    for (let i = 0; i < seedBlocks; i++) {
      blocks.push({
        x: CHAIN_RIGHT - i * PITCH,
        tx: ASSEM_X - (i + 1) * PITCH < 0 ? 0 : CHAIN_RIGHT - i * PITCH,
        pixels: Array.from({ length: total }, () => randFee(intro)),
        height: 0,
      });
    }
    blocks.forEach((b) => (b.tx = b.x));

    let spawnAcc = 0;
    let cycleAcc = 0;
    const spawnEvery = intro ? 320 : 170; // ms per new tx
    const cycleEvery = intro ? 8500 : 6000; // ms per block (slower)

    const spawnTx = () => {
      const pooled = txs.filter((t) => t.phase !== "toblock").length;
      if (pooled >= memCap) return;
      // next free mempool slot
      let i = 0;
      const occupied = new Set(txs.filter((t) => t.phase === "pool" || t.phase === "in").map((t) => t.slot));
      while (occupied.has(i) && i < memCap) i++;
      const s = memSlot(i);
      txs.push({
        x: CW + rnd(2, 30),
        y: rnd(MEM_Y0, CH - 6),
        tx0: s.x,
        ty0: s.y,
        fee: randFee(intro),
        phase: "in",
        slot: i,
        flash: 0,
      });
    };

    const startMining = () => {
      const pool = txs.filter((t) => t.phase === "pool");
      if (pool.length < total * 0.6) return; // wait for enough
      pool.sort((a, b) => b.fee - a.fee);
      const pick = pool.slice(0, total);
      forming.forEach((f) => {
        f.fee = 0;
        f.filled = false;
      });
      formingActive = true;
      pick.forEach((t, k) => {
        t.phase = "toblock";
        t.slot = k;
        const col = k % BN;
        const row = Math.floor(k / BN);
        t.tx0 = ASSEM_X - BLOCK / 2 + 2 + col * TX;
        t.ty0 = ASSEM_Y - BLOCK / 2 + 2 + row * TX;
      });
    };

    const sealBlock = () => {
      // build a chain block from the forming pixels
      blocks.unshift({
        x: ASSEM_X - BLOCK / 2,
        tx: CHAIN_RIGHT,
        pixels: forming.map((f) => f.fee),
        height: 0,
      });
      // shift existing chain left
      for (let i = 1; i < blocks.length; i++) blocks[i].tx = CHAIN_RIGHT - i * PITCH;
      formingActive = false;
      setMinted((m) => m + 1);
    };

    const step = (dt: number) => {
      // spawn
      spawnAcc += dt;
      while (spawnAcc >= spawnEvery) {
        spawnAcc -= spawnEvery;
        spawnTx();
      }
      // mining cycle
      cycleAcc += dt;
      if (cycleAcc >= cycleEvery) {
        cycleAcc = 0;
        if (!formingActive) startMining();
      }

      // move txs
      const k = Math.min(1, dt / 1000);
      for (const t of txs) {
        if (t.phase === "in") {
          t.x += (t.tx0 - t.x) * Math.min(1, k * 3);
          t.y += (t.ty0 - t.y) * Math.min(1, k * 3);
          if (Math.abs(t.x - t.tx0) < 0.6 && Math.abs(t.y - t.ty0) < 0.6) {
            t.x = t.tx0;
            t.y = t.ty0;
            t.phase = "pool";
          }
        } else if (t.phase === "toblock") {
          t.x += (t.tx0 - t.x) * Math.min(1, k * 4);
          t.y += (t.ty0 - t.y) * Math.min(1, k * 4);
          if (Math.abs(t.x - t.tx0) < 0.5 && Math.abs(t.y - t.ty0) < 0.5) {
            forming[t.slot].fee = t.fee;
            forming[t.slot].filled = true;
          }
        }
        if (t.flash > 0) t.flash -= dt;
      }
      // seal when block full
      if (formingActive && forming.every((f) => f.filled)) {
        // drop the consumed txs
        for (let i = txs.length - 1; i >= 0; i--) if (txs[i].phase === "toblock") txs.splice(i, 1);
        sealBlock();
      }

      // nodes wander + check
      for (const n of nodes) {
        n.x += n.vx * k;
        n.y += n.vy * k;
        if (n.x < MEM_X0 - 30 || n.x > CW - 6) n.vx *= -1;
        if (n.y < 8 || n.y > NODE_Y1) n.vy *= -1;
        n.x = Math.max(MEM_X0 - 30, Math.min(CW - 6, n.x));
        n.y = Math.max(8, Math.min(NODE_Y1, n.y));
        n.t -= dt / 1000;
        if (n.t <= 0) {
          n.t = rnd(0.8, 2.2);
          const pool = txs.filter((t) => t.phase === "pool");
          if (pool.length) {
            const tgt = pool[Math.floor(Math.random() * pool.length)];
            tgt.flash = 360;
            n.target = txs.indexOf(tgt);
          } else n.target = -1;
        }
      }

      // chain shift toward target; cull off-screen
      for (let i = blocks.length - 1; i >= 0; i--) {
        const b = blocks[i];
        b.x += (b.tx - b.x) * Math.min(1, k * 2.2);
        if (b.x + BLOCK < -2) blocks.splice(i, 1);
      }
    };

    const drawBlockPixels = (x: number, y: number, pixels: number[], filledFn?: (i: number) => boolean) => {
      for (let i = 0; i < pixels.length; i++) {
        const col = i % BN;
        const row = Math.floor(i / BN);
        const filled = filledFn ? filledFn(i) : true;
        if (!filled) {
          ctx.fillStyle = "#15171f";
        } else {
          ctx.fillStyle = feeToColor(pixels[i] || 1);
        }
        ctx.fillRect(x + 2 + col * TX, y + 2 + row * TX, TX - 1, TX - 1);
      }
    };

    const drawFrame = (x: number, y: number, color: string) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, y + 0.5, BLOCK - 1, BLOCK - 1);
    };

    const accent = "#f7931a";
    const blue = "#5b9bd5";
    const faint = "#5a6170";

    const draw = () => {
      ctx.clearRect(0, 0, CW, CH);
      const hov = hoveredRef.current;

      // ---- mempool pixels ----
      for (const t of txs) {
        if (t.phase === "toblock") continue;
        ctx.fillStyle = t.flash > 0 ? "#eaf2ea" : feeToColor(t.fee);
        ctx.fillRect(t.x, t.y, TX - 1, TX - 1);
      }

      // ---- nodes (robots) + scan beams ----
      for (const n of nodes) {
        if (n.target >= 0 && txs[n.target] && txs[n.target].phase === "pool") {
          ctx.strokeStyle = "rgba(91,155,213,0.45)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(n.x + 2, n.y + 4);
          ctx.lineTo(txs[n.target].x + 1, txs[n.target].y + 1);
          ctx.stroke();
        }
        ctx.fillStyle = blue;
        ctx.fillRect(n.x, n.y, 4, 4); // body
        ctx.fillStyle = faint;
        ctx.fillRect(n.x, n.y - 1, 1, 1); // antennae
        ctx.fillRect(n.x + 3, n.y - 1, 1, 1);
        ctx.fillStyle = accent;
        ctx.fillRect(n.x + 1, n.y + 1, 1, 1); // eye
      }

      // ---- txs flying into the forming block ----
      for (const t of txs) {
        if (t.phase !== "toblock") continue;
        ctx.fillStyle = feeToColor(t.fee);
        ctx.fillRect(t.x, t.y, TX - 1, TX - 1);
      }

      // ---- forming block (assembly) ----
      if (formingActive) {
        const bx = ASSEM_X - BLOCK / 2;
        const by = ASSEM_Y - BLOCK / 2;
        drawBlockPixels(bx, by, forming.map((f) => f.fee), (i) => forming[i].filled);
        drawFrame(bx, by, accent);
      }

      // ---- miner glyph ----
      ctx.fillStyle = formingActive ? accent : faint;
      ctx.fillRect(ASSEM_X - 2, ASSEM_Y + BLOCK / 2 + 6, 4, 4);
      ctx.fillRect(ASSEM_X - 5, ASSEM_Y + BLOCK / 2 + 10, 10, 2);

      // ---- chain blocks + links ----
      for (let i = blocks.length - 1; i >= 0; i--) {
        const b = blocks[i];
        const by = ASSEM_Y - BLOCK / 2;
        drawBlockPixels(b.x, by, b.pixels);
        drawFrame(b.x, by, faint);
        // link to the block on its right (i-1) — draw as interlocking bars
        const right = blocks[i - 1];
        const rx = right ? right.x : CHAIN_RIGHT + (formingActive ? 0 : 0);
        if (right || i === 0) {
          const lx = b.x + BLOCK;
          const lw = (right ? right.x : ASSEM_X - BLOCK / 2) - lx;
          if (lw > 0 && lw < PITCH) {
            const ly = ASSEM_Y - 3;
            ctx.strokeStyle = accent;
            ctx.lineWidth = 1;
            ctx.strokeRect(lx + 0.5, ly + 0.5, lw - 1, 6);
          }
        }
        void rx;
      }

      // ---- hover highlight ----
      if (hov) {
        const z = zone(hov);
        ctx.strokeStyle = accent;
        ctx.lineWidth = 1;
        ctx.strokeRect(z.x + 0.5, z.y + 0.5, z.w - 1, z.h - 1);
      }
    };

    let raf = 0;
    let last = 0;

    if (reduced) {
      // build a representative static frame
      for (let i = 0; i < 60; i++) spawnTx();
      for (let s = 0; s < 200; s++) step(16);
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
      const dt = Math.min(60, t - last);
      last = t;
      step(dt);
      draw();
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [reduced, intro]);

  const eff: Region | null = hovered ?? (intro ? null : tour);
  const info = eff ? MAP[eff] : null;

  return (
    <div ref={wrapRef} className="w-full" data-no-swipe>
      <div
        className="relative w-full overflow-hidden border border-border bg-bg"
        style={{ aspectRatio: `${CW} / ${CH}` }}
      >
        <canvas
          ref={canvasRef}
          width={CW}
          height={CH}
          className="absolute inset-0 h-full w-full"
          style={{ imageRendering: "pixelated" }}
          aria-hidden
        />
        <svg
          viewBox={`0 0 ${CW} ${CH}`}
          className="absolute inset-0 h-full w-full"
          preserveAspectRatio="none"
          role="img"
          aria-label="The Bitcoin transaction lifecycle: transactions gather in the mempool, nodes validate them, a miner packs a block, and it links onto the chain. Hover or focus a part to inspect it."
        >
          <g role="group" aria-label="Inspect the machine">
            <rect x={0} y={0} width={CW} height={CH} fill="transparent" onClick={() => setHovered(null)} />
            {REGION_ORDER.map((r) => {
              const z = zone(r);
              return (
                <rect
                  key={r}
                  x={z.x}
                  y={z.y}
                  width={z.w}
                  height={z.h}
                  fill="transparent"
                  tabIndex={0}
                  role="button"
                  aria-label={MAP[r].title}
                  style={{ cursor: "pointer", outline: "none" }}
                  onMouseEnter={() => setHovered(r)}
                  onMouseLeave={() => setHovered(null)}
                  onFocus={() => setHovered(r)}
                  onBlur={() => setHovered(null)}
                  onClick={() => setHovered(r)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setHovered(r);
                    }
                  }}
                />
              );
            })}
          </g>
        </svg>

        {/* labels */}
        <div className="pointer-events-none absolute inset-0 font-mono text-[0.6rem] text-faint">
          <span className="absolute" style={{ left: "2%", top: "4%" }}>
            ← the chain (history)
          </span>
          <span className="absolute" style={{ right: "2%", top: "4%" }}>
            mempool →
          </span>
          <span className="absolute text-muted" style={{ right: "2%", bottom: "3%" }}>
            {intro ? "" : `blocks mined · ${minted.toLocaleString()}`}
          </span>
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
            <div className="mt-1 text-xs text-muted">{info.term}</div>
            <p className="mt-1.5 text-xs leading-relaxed text-muted">{info.body}</p>
          </div>
        ) : (
          <div className="text-xs text-muted">
            {`// inspect`} · tap or hover any part — mempool, nodes, miner, block,
            chain <span className="text-accent blink">█</span>
          </div>
        )}
      </div>
    </div>
  );
}

// hover/inspect zones in canvas coordinates
function zone(r: Region): { x: number; y: number; w: number; h: number } {
  switch (r) {
    case "chain":
      return { x: 0, y: ASSEM_Y - BLOCK / 2 - 6, w: CHAIN_RIGHT + BLOCK, h: BLOCK + 12 };
    case "link":
      return { x: CHAIN_RIGHT + BLOCK - 2, y: ASSEM_Y - 8, w: PITCH, h: 16 };
    case "block":
      return { x: ASSEM_X - BLOCK / 2 - 3, y: ASSEM_Y - BLOCK / 2 - 3, w: BLOCK + 6, h: BLOCK + 6 };
    case "miner":
      return { x: ASSEM_X - 12, y: ASSEM_Y + BLOCK / 2 + 4, w: 24, h: 18 };
    case "mempool":
      return { x: MEM_X0 - 6, y: MEM_Y0 - 2, w: CW - MEM_X0 + 6, h: CH - MEM_Y0 };
    case "nodes":
      return { x: MEM_X0 - 32, y: 0, w: CW - MEM_X0 + 32, h: NODE_Y1 + 4 };
  }
}
