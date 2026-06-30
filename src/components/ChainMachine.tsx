"use client";

import { useEffect, useRef, useState } from "react";
import { feeToColor } from "@/lib/fee";

/* =====================================================================
   The Bitcoin lifecycle, drawn pixel-by-pixel (one pixel ≈ one tx):
   transactions gather in the MEMPOOL → NODE robots validate them → a
   MINER packs the top-fee ones into a block and HASHES until it finds
   proof-of-work → the sealed BLOCK links onto the CHAIN, which scrolls
   off-screen as history. Crisp, no antialiasing.
   ===================================================================== */

const CW = 460; // canvas internal pixels (nearest-neighbour upscaled by CSS)
const CH = 188;
const TX = 4; // one transaction = one little pixel (3px + 1px gap)
const PX = TX - 1;
const BN = 6; // block is BN×BN transactions
const TOTAL = BN * BN;
const BLOCK = BN * TX + 4;
const LINK = 12;
const PITCH = BLOCK + LINK;

const ASSEM_X = 208;
const ASSEM_Y = 96;
const CHAIN_RIGHT = 168;
const MEM_X0 = 252;
const MEM_Y0 = 78;
const NODE_Y1 = 70;

type Region = "chain" | "link" | "block" | "miner" | "mempool" | "nodes";

const MAP: Record<Region, { title: string; term: string; body: string }> = {
  mempool: {
    title: "the mempool",
    term: "unconfirmed transactions",
    body: "Every payment is broadcast and waits here as one pixel until a miner picks it. Warmer colours pay a higher fee and get chosen first.",
  },
  nodes: {
    title: "the nodes",
    term: "validators / relayers",
    body: "Thousands of independent computers relay each transaction and re-check every rule themselves. No one is in charge; invalid transactions are simply ignored.",
  },
  miner: {
    title: "the miner",
    term: "proof-of-work",
    body: "A miner packs transactions into a block, then guesses hashes billions of times until one starts with enough zeros. That costly search is what earns the right to add the block.",
  },
  block: {
    title: "a block",
    term: "a batch of transactions",
    body: "Each pixel here is one transaction, packed into a single block — about one is sealed every ten minutes. Watch it fill, get hashed, then snap onto the chain.",
  },
  chain: {
    title: "the blockchain",
    term: "the shared history",
    body: "Sealed blocks, oldest scrolling off into history. Every node keeps this same ordered record; once a block is buried it's effectively permanent.",
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
  tx0: number;
  ty0: number;
  fee: number;
  phase: "in" | "pool" | "toblock";
  slot: number;
  flash: number;
};
type Blk = { x: number; tx: number; pixels: number[] };
type Node = { x: number; y: number; vx: number; vy: number; t: number; target: number };
type Status = { phase: "idle" | "gather" | "hash" | "found"; attempts: number; hash: string; n: number };

const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const randFee = (intro: boolean) => Math.random() ** 2 * (intro ? 40 : 130) + 1;
const hex = (n: number) =>
  Array.from({ length: n }, () => "0123456789abcdef"[(Math.random() * 16) | 0]).join("");
const fmtHashes = (a: number) =>
  a >= 1e9 ? `${(a / 1e9).toFixed(2)} billion` : a >= 1e6 ? `${(a / 1e6).toFixed(1)} million` : `${Math.round(a)}`;

export default function ChainMachine({ mode }: { mode: "intro" | "outro" }) {
  const intro = mode === "intro";
  const [hovered, setHovered] = useState<Region | null>(null);
  const [tour, setTour] = useState<Region | null>(intro ? null : "mempool");
  const [minted, setMinted] = useState(intro ? 0 : 11);
  const [reduced, setReduced] = useState(false);
  const [status, setStatus] = useState<Status>({ phase: "idle", attempts: 0, hash: "00000000", n: intro ? 1 : 12 });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const visibleRef = useRef(true);
  const hoveredRef = useRef<Region | null>(null);
  const statusRef = useRef<Status>({ phase: "idle", attempts: 0, hash: "00000000", n: intro ? 1 : 12 });
  useEffect(() => {
    hoveredRef.current = hovered;
  }, [hovered]);

  useEffect(() => {
    const m = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setReduced(m.matches);
    on();
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const io = new IntersectionObserver((e) => (visibleRef.current = e[0].isIntersecting), { threshold: 0.05 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (intro || reduced) return;
    let i = 0;
    const id = setInterval(() => {
      i = (i + 1) % REGION_ORDER.length;
      setTour(REGION_ORDER[i]);
    }, 4200);
    return () => clearInterval(id);
  }, [intro, reduced]);

  // mirror the mining status into React for the overlay (throttled)
  useEffect(() => {
    if (reduced) return;
    const id = setInterval(() => {
      if (visibleRef.current) setStatus({ ...statusRef.current });
    }, 100);
    return () => clearInterval(id);
  }, [reduced]);

  // simulation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;

    const memCols = Math.floor((CW - MEM_X0 - 2) / TX);
    const memRows = Math.floor((CH - MEM_Y0 - 2) / TX);
    const memCap = memCols * memRows;
    const memSlot = (i: number) => ({
      x: MEM_X0 + (i % memCols) * TX,
      y: CH - 2 - (Math.floor(i / memCols) + 1) * TX,
    });

    const txs: Tx[] = [];
    const blocks: Blk[] = [];
    const forming: { fee: number; filled: boolean }[] = Array.from({ length: TOTAL }, () => ({ fee: 0, filled: false }));

    const nodes: Node[] = Array.from({ length: intro ? 3 : 4 }, () => ({
      x: rnd(MEM_X0 - 24, CW - 8),
      y: rnd(8, NODE_Y1),
      vx: rnd(-11, 11),
      vy: rnd(-7, 7),
      t: rnd(0, 2),
      target: -1,
    }));

    // seed history
    for (let i = 0; i < (intro ? 4 : 7); i++) {
      blocks.push({ x: CHAIN_RIGHT - i * PITCH, tx: CHAIN_RIGHT - i * PITCH, pixels: Array.from({ length: TOTAL }, () => randFee(intro)) });
    }
    // seed a visible mempool pile
    const seedPool = Math.min(memCap, intro ? 120 : 220);
    for (let i = 0; i < seedPool; i++) {
      const s = memSlot(i);
      txs.push({ x: s.x, y: s.y, tx0: s.x, ty0: s.y, fee: randFee(intro), phase: "pool", slot: i, flash: 0 });
    }

    let spawnAcc = 0;
    let phaseT = 0;
    const st = statusRef.current;
    st.phase = "idle";
    const spawnEvery = intro ? 150 : 80;
    const IDLE_MS = intro ? 2600 : 1500;
    const HASH_MS = intro ? 2800 : 1900;
    const FOUND_MS = 1000;

    const spawnTx = () => {
      const pooled = txs.filter((t) => t.phase !== "toblock").length;
      if (pooled >= memCap) return;
      const occ = new Set(txs.filter((t) => t.phase === "pool" || t.phase === "in").map((t) => t.slot));
      let i = 0;
      while (occ.has(i) && i < memCap) i++;
      const s = memSlot(i);
      txs.push({ x: CW + rnd(2, 26), y: rnd(MEM_Y0, CH - 6), tx0: s.x, ty0: s.y, fee: randFee(intro), phase: "in", slot: i, flash: 0 });
    };

    const startGather = () => {
      const pool = txs.filter((t) => t.phase === "pool");
      if (pool.length < TOTAL) return false;
      pool.sort((a, b) => b.fee - a.fee);
      forming.forEach((f) => ((f.fee = 0), (f.filled = false)));
      pool.slice(0, TOTAL).forEach((t, k) => {
        t.phase = "toblock";
        t.slot = k;
        t.tx0 = ASSEM_X - BLOCK / 2 + 2 + (k % BN) * TX;
        t.ty0 = ASSEM_Y - BLOCK / 2 + 2 + Math.floor(k / BN) * TX;
      });
      return true;
    };

    const seal = () => {
      blocks.unshift({ x: ASSEM_X - BLOCK / 2, tx: CHAIN_RIGHT, pixels: forming.map((f) => f.fee) });
      for (let i = 1; i < blocks.length; i++) blocks[i].tx = CHAIN_RIGHT - i * PITCH;
      for (let i = txs.length - 1; i >= 0; i--) if (txs[i].phase === "toblock") txs.splice(i, 1);
      setMinted((m) => m + 1);
    };

    const step = (dt: number) => {
      spawnAcc += dt;
      while (spawnAcc >= spawnEvery) {
        spawnAcc -= spawnEvery;
        spawnTx();
      }
      phaseT += dt;
      const k = Math.min(1, dt / 1000);

      // mining phase machine
      if (st.phase === "idle") {
        if (phaseT >= IDLE_MS && startGather()) {
          st.phase = "gather";
          phaseT = 0;
        }
      } else if (st.phase === "gather") {
        if (forming.every((f) => f.filled)) {
          st.phase = "hash";
          st.attempts = 0;
          phaseT = 0;
        }
      } else if (st.phase === "hash") {
        st.attempts += rnd(1.4e7, 5e7) * (dt / 16);
        st.hash = hex(8);
        if (phaseT >= HASH_MS) {
          st.phase = "found";
          st.hash = "0000" + hex(4);
          st.n = minted + 1;
          phaseT = 0;
        }
      } else if (st.phase === "found") {
        if (phaseT >= FOUND_MS) {
          seal();
          st.phase = "idle";
          phaseT = 0;
        }
      }

      // move txs
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

      // nodes
      for (const n of nodes) {
        n.x += n.vx * k;
        n.y += n.vy * k;
        if (n.x < MEM_X0 - 24 || n.x > CW - 8) n.vx *= -1;
        if (n.y < 8 || n.y > NODE_Y1) n.vy *= -1;
        n.x = Math.max(MEM_X0 - 24, Math.min(CW - 8, n.x));
        n.y = Math.max(8, Math.min(NODE_Y1, n.y));
        n.t -= dt / 1000;
        if (n.t <= 0) {
          n.t = rnd(0.8, 2.2);
          const pool = txs.filter((t) => t.phase === "pool");
          if (pool.length) {
            const tgt = pool[(Math.random() * pool.length) | 0];
            tgt.flash = 360;
            n.target = txs.indexOf(tgt);
          } else n.target = -1;
        }
      }

      // chain shift + cull off-screen
      for (let i = blocks.length - 1; i >= 0; i--) {
        const b = blocks[i];
        b.x += (b.tx - b.x) * Math.min(1, k * 2);
        if (b.x + BLOCK < -2) blocks.splice(i, 1);
      }
    };

    // ---- crisp drawing helpers (integer-aligned, no AA) ----
    const R = Math.round;
    const rect = (x: number, y: number, w: number, h: number, c: string) => {
      ctx.fillStyle = c;
      ctx.fillRect(R(x), R(y), R(w), R(h));
    };
    const frame = (x: number, y: number, s: number, c: string) => {
      rect(x, y, s, 1, c);
      rect(x, y + s - 1, s, 1, c);
      rect(x, y, 1, s, c);
      rect(x + s - 1, y, 1, s, c);
    };
    const pixLine = (x0: number, y0: number, x1: number, y1: number, c: string) => {
      // Bresenham, plotting whole pixels (no AA), every other step
      let X = R(x0),
        Y = R(y0);
      const dx = Math.abs(R(x1) - X),
        dy = -Math.abs(R(y1) - Y);
      const sx = X < x1 ? 1 : -1,
        sy = Y < y1 ? 1 : -1;
      let err = dx + dy,
        i = 0;
      ctx.fillStyle = c;
      for (;;) {
        if (i++ % 2 === 0) ctx.fillRect(X, Y, 1, 1);
        if (X === R(x1) && Y === R(y1)) break;
        const e2 = 2 * err;
        if (e2 >= dy) {
          err += dy;
          X += sx;
        }
        if (e2 <= dx) {
          err += dx;
          Y += sy;
        }
      }
    };
    const blockPixels = (x: number, y: number, pixels: number[], filledFn?: (i: number) => boolean) => {
      for (let i = 0; i < pixels.length; i++) {
        const filled = filledFn ? filledFn(i) : true;
        rect(x + 2 + (i % BN) * TX, y + 2 + Math.floor(i / BN) * TX, PX, PX, filled ? feeToColor(pixels[i] || 1) : "#15171f");
      }
    };

    const accent = "#f7931a";
    const green = "#43c98b";
    const blue = "#5b9bd5";
    const faint = "#5a6170";

    const draw = () => {
      ctx.clearRect(0, 0, CW, CH);
      const hov = hoveredRef.current;

      // mempool pixels
      for (const t of txs) {
        if (t.phase === "toblock") continue;
        rect(t.x, t.y, PX, PX, t.flash > 0 ? "#eef3ee" : feeToColor(t.fee));
      }

      // node robots + scan beams
      for (const n of nodes) {
        if (n.target >= 0 && txs[n.target] && txs[n.target].phase === "pool") {
          pixLine(n.x + 2, n.y + 4, txs[n.target].x + 1, txs[n.target].y + 1, "rgba(91,155,213,0.7)");
        }
        rect(n.x, n.y, 4, 4, blue);
        rect(n.x, n.y - 1, 1, 1, faint);
        rect(n.x + 3, n.y - 1, 1, 1, faint);
        rect(n.x + 1, n.y + 1, 1, 1, accent);
      }

      // txs flying into the block
      for (const t of txs) {
        if (t.phase === "toblock") rect(t.x, t.y, PX, PX, feeToColor(t.fee));
      }

      // forming block
      if (st.phase === "gather" || st.phase === "hash" || st.phase === "found") {
        const bx = ASSEM_X - BLOCK / 2;
        const by = ASSEM_Y - BLOCK / 2;
        blockPixels(bx, by, forming.map((f) => f.fee), (i) => forming[i].filled);
        const pulse = st.phase === "hash" ? (R(phaseT / 90) % 2 === 0 ? accent : faint) : st.phase === "found" ? green : accent;
        frame(bx, by, BLOCK, pulse);
      }

      // miner glyph (pickaxe-ish), animated while hashing
      const my = ASSEM_Y + BLOCK / 2 + 6;
      const mc = st.phase === "hash" ? accent : st.phase === "found" ? green : faint;
      rect(ASSEM_X - 1, my + (st.phase === "hash" && R(phaseT / 70) % 2 ? 1 : 0), 2, 3, mc);
      rect(ASSEM_X - 4, my + 4, 9, 1, mc);

      // chain blocks + links
      for (let i = blocks.length - 1; i >= 0; i--) {
        const b = blocks[i];
        const by = ASSEM_Y - BLOCK / 2;
        blockPixels(b.x, by, b.pixels);
        frame(b.x, by, BLOCK, faint);
        const right = blocks[i - 1];
        const rightX = right ? right.x : st.phase !== "idle" ? ASSEM_X - BLOCK / 2 : -999;
        if (rightX > b.x) {
          const lx = b.x + BLOCK;
          const lw = rightX - lx;
          if (lw > 0 && lw <= LINK + 2) {
            // a small chain-link: hollow box + bar bridging the two blocks
            const ly = ASSEM_Y - 4;
            const lh = 8;
            rect(lx, ly, lw, 1, accent);
            rect(lx, ly + lh - 1, lw, 1, accent);
            rect(lx, ly, 1, lh, accent);
            rect(lx + lw - 1, ly, 1, lh, accent);
            rect(lx, ASSEM_Y - 1, lw, 2, accent);
          }
        }
      }

      // hover highlight (integer-aligned outline)
      if (hov) {
        const z = zone(hov);
        rect(z.x, z.y, z.w, 1, accent);
        rect(z.x, z.y + z.h - 1, z.w, 1, accent);
        rect(z.x, z.y, 1, z.h, accent);
        rect(z.x + z.w - 1, z.y, 1, z.h, accent);
      }
    };

    let raf = 0;
    let last = 0;

    if (reduced) {
      for (let i = 0; i < 80; i++) spawnTx();
      for (let s = 0; s < 220; s++) step(16);
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
  }, [reduced, intro, minted]);

  const eff: Region | null = hovered ?? (intro ? null : tour);
  const info = eff ? MAP[eff] : null;

  return (
    <div ref={wrapRef} className="w-full" data-no-swipe>
      <div className="relative w-full overflow-hidden border border-border bg-bg" style={{ aspectRatio: `${CW} / ${CH}` }}>
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
          aria-label="The Bitcoin transaction lifecycle: transactions gather in the mempool, nodes validate them, a miner hashes a block, and it links onto the chain. Hover or focus a part to inspect it."
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

        {/* labels + live mining readout */}
        <div className="pointer-events-none absolute inset-0 font-mono text-[0.6rem] text-faint">
          <span className="absolute" style={{ left: "2%", top: "4%" }}>
            ← the chain (history)
          </span>
          <span className="absolute" style={{ right: "2%", top: "4%" }}>
            mempool →
          </span>
          {!intro && (
            <span className="absolute text-muted" style={{ right: "2%", bottom: "3%" }}>
              blocks mined · {minted.toLocaleString()}
            </span>
          )}
          {/* mining proof-of-work readout, centred over the assembly */}
          <span
            className="absolute -translate-x-1/2 whitespace-nowrap text-center"
            style={{ left: `${(ASSEM_X / CW) * 100}%`, top: "22%" }}
          >
            {status.phase === "hash" && (
              <span className="text-accent">
                ⛏ mining · nonce 0x{status.hash} · {fmtHashes(status.attempts)} hashes
              </span>
            )}
            {status.phase === "found" && (
              <span className="text-green">✓ block #{status.n} sealed · hash {status.hash}…</span>
            )}
            {status.phase === "gather" && <span className="text-muted">⛏ packing transactions…</span>}
          </span>
        </div>
      </div>

      <div className="mt-2 border border-border bg-panel/60 p-3 text-left font-mono" aria-live="polite" aria-atomic="true">
        {info ? (
          <div>
            <div className="text-[0.7rem] tracking-wide text-accent">{`// ${info.title}`}</div>
            <div className="mt-1 text-xs text-muted">{info.term}</div>
            <p className="mt-1.5 text-xs leading-relaxed text-muted">{info.body}</p>
          </div>
        ) : (
          <div className="text-xs text-muted">
            {`// inspect`} · tap or hover any part — mempool, nodes, miner, block, chain{" "}
            <span className="text-accent blink">█</span>
          </div>
        )}
      </div>
    </div>
  );
}

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
      return { x: MEM_X0 - 26, y: 0, w: CW - MEM_X0 + 26, h: NODE_Y1 + 4 };
  }
}
