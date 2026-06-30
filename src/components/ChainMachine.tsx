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

const SCALE = 2; // backing-store supersample → crisp, uniform pixels
const CW = 460; // logical width
const CH = 188;
const TX = 4; // one transaction cell (pitch)
const PX = TX - 0.5; // pixel fills the cell leaving exactly a 1px gap at 2×
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
const MID = ASSEM_Y - BLOCK / 2; // the chain row (block top)
const TOPB = MID - 38; // top miner block (green)
const BOTB = MID + 38; // bottom miner block (blue)
const ABX = ASSEM_X - BLOCK / 2; // assembly block x
const VERIFY_X = 210; // centre stage where the winning block is checked before joining

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
    title: "the miners",
    term: "racing for the block",
    body: "Two miners (green on top, blue below) each pack a block and guess hashes as fast as they can. Whoever finds a valid hash first wins — their block is added with their own colour outline, and the race restarts on top of it.",
  },
  block: {
    title: "a block",
    term: "a batch of transactions",
    body: "Each pixel is one transaction. The two bars on top are the block header: the left one is the previous block's hash (fixed — it's the link back), the right one is the nonce, which the miner keeps changing until the hash comes out right.",
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

const REGION_ORDER: Region[] = ["mempool", "nodes", "chain", "link", "block", "miner"];

type Tx = {
  x: number;
  y: number;
  tx0: number;
  ty0: number;
  fee: number;
  phase: "in" | "pool";
  slot: number;
  sel: boolean; // selected for the current round — stays in the mempool until confirmed
  flash: number;
};
// a transaction copied toward one miner's block (preserves the tx colour)
type Copy = { x: number; y: number; tx0: number; ty0: number; fee: number; mb: 0 | 1; slot: number };
// a block header: ph = prev-block-hash swatch (fixed), nonce = the nonce swatch
type Blk = { x: number; tx: number; y: number; ty: number; color: string; pixels: number[]; ph: string; nonce: string };
type Node = { x: number; y: number; vx: number; vy: number; t: number; target: number };
type Status = { phase: "idle" | "gather" | "hash" | "found" | "verify"; winner: number }; // winner: -1 none, 0 green, 1 blue

const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const randFee = (intro: boolean) => Math.random() ** 2 * (intro ? 40 : 130) + 1;
// header swatches stand in for the 256-bit header fields, shown as colour
const hsl = (h: number, s: number, l: number) => `hsl(${Math.round(h)}, ${s}%, ${l}%)`;
const randHue = () => Math.random() * 360;

export default function ChainMachine({ mode }: { mode: "intro" | "outro" }) {
  const intro = mode === "intro";
  const [hovered, setHovered] = useState<Region | null>(null);
  const [tour, setTour] = useState<Region | null>(intro ? null : "mempool");
  const [minted, setMinted] = useState(intro ? 0 : 11);
  const [reduced, setReduced] = useState(false);
  const [status, setStatus] = useState<Status>({ phase: "idle", winner: -1 });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const visibleRef = useRef(true);
  const hoveredRef = useRef<Region | null>(null);
  const statusRef = useRef<Status>({ phase: "idle", winner: -1 });
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
    const accent = "#f7931a";
    const green = "#43c98b";
    const blue = "#5b9bd5";
    const faint = "#5a6170";

    const memCols = Math.floor((CW - MEM_X0 - 2) / TX);
    const memRows = Math.floor((CH - MEM_Y0 - 2) / TX);
    const memCap = memCols * memRows;
    const memSlot = (i: number) => ({
      x: MEM_X0 + (i % memCols) * TX,
      y: CH - 2 - (Math.floor(i / memCols) + 1) * TX,
    });

    const txs: Tx[] = [];
    const copies: Copy[] = [];
    const blocks: Blk[] = [];
    const formingTop = Array.from({ length: TOTAL }, () => ({ fee: 0, filled: false }));
    const formingBot = Array.from({ length: TOTAL }, () => ({ fee: 0, filled: false }));

    // header swatches — prev-hash is shared by both miners (same chain tip) and
    // stays fixed for the round; each miner's nonce drifts while it hashes.
    let roundPHHue = randHue();
    let nonceTopHue = randHue();
    let nonceBotHue = randHue();
    // the winning block, after it leaves a miner and before it joins the chain:
    // it slides to centre stage where the nodes check its 3 parts.
    let verifying: Blk | null = null;

    const nodes: Node[] = Array.from({ length: intro ? 3 : 4 }, () => ({
      x: rnd(MEM_X0 - 24, CW - 8),
      y: rnd(8, NODE_Y1),
      vx: rnd(-11, 11),
      vy: rnd(-7, 7),
      t: rnd(0, 2),
      target: -1,
    }));

    // seed history (alternating winner colours), each with its own header swatches
    for (let i = 0; i < (intro ? 4 : 7); i++) {
      const x = CHAIN_RIGHT - i * PITCH;
      blocks.push({ x, tx: x, y: MID, ty: MID, color: i % 2 ? blue : green, pixels: Array.from({ length: TOTAL }, () => randFee(intro)), ph: hsl(randHue(), 52, 50), nonce: hsl(randHue(), 60, 55) });
    }
    // seed a visible mempool pile
    const seedPool = Math.min(memCap, intro ? 120 : 220);
    for (let i = 0; i < seedPool; i++) {
      const s = memSlot(i);
      txs.push({ x: s.x, y: s.y, tx0: s.x, ty0: s.y, fee: randFee(intro), phase: "pool", slot: i, sel: false, flash: 0 });
    }

    let spawnAcc = 0;
    let phaseT = 0;
    const st = statusRef.current;
    st.phase = "idle";
    const spawnEvery = intro ? 150 : 80;
    const IDLE_MS = intro ? 2600 : 1500;
    const HASH_MS = intro ? 2800 : 1900;
    const FOUND_MS = 850;
    const VERIFY_MS = intro ? 2100 : 1500; // nodes check the 3 parts in sequence (~700ms each)

    const spawnTx = () => {
      if (txs.length >= memCap) return;
      const occ = new Set(txs.map((t) => t.slot));
      let i = 0;
      while (occ.has(i) && i < memCap) i++;
      const s = memSlot(i);
      txs.push({ x: CW + rnd(2, 26), y: rnd(MEM_Y0, CH - 6), tx0: s.x, ty0: s.y, fee: randFee(intro), phase: "in", slot: i, sel: false, flash: 0 });
    };

    const vary = (f: number) => Math.max(1, f * (1 + (Math.random() - 0.5) * 0.16)); // very similar, tiny bit different
    const startGather = () => {
      const pool = txs.filter((t) => t.phase === "pool" && !t.sel);
      if (pool.length < TOTAL) return false;
      pool.sort((a, b) => b.fee - a.fee);
      formingTop.forEach((f) => ((f.fee = 0), (f.filled = false)));
      formingBot.forEach((f) => ((f.fee = 0), (f.filled = false)));
      roundPHHue = randHue(); // new chain tip → new prev-hash for both miners
      copies.length = 0;
      // both miners see the SAME transactions — copy each one to both blocks
      pool.slice(0, TOTAL).forEach((t, k) => {
        t.sel = true;
        const cx = ABX + 2 + (k % BN) * TX;
        const cy = 2 + Math.floor(k / BN) * TX;
        copies.push({ x: t.x, y: t.y, tx0: cx, ty0: TOPB + cy, fee: vary(t.fee), mb: 0, slot: k });
        copies.push({ x: t.x, y: t.y, tx0: cx, ty0: BOTB + cy, fee: vary(t.fee), mb: 1, slot: k });
      });
      return true;
    };

    // promote the winning miner block to centre stage for verification
    const startVerify = () => {
      const wf = st.winner === 0 ? formingTop : formingBot;
      const color = st.winner === 0 ? green : blue;
      const startY = st.winner === 0 ? TOPB : BOTB;
      const nh = st.winner === 0 ? nonceTopHue : nonceBotHue; // the winning nonce, frozen
      verifying = { x: ABX, tx: VERIFY_X, y: startY, ty: MID, color, pixels: wf.map((f) => f.fee), ph: hsl(roundPHHue, 52, 50), nonce: hsl(nh, 60, 55) };
      formingTop.forEach((f) => ((f.fee = 0), (f.filled = false)));
      formingBot.forEach((f) => ((f.fee = 0), (f.filled = false)));
      copies.length = 0;
    };

    // checks passed → the verified block joins the chain tip
    const seal = () => {
      if (verifying) {
        verifying.tx = CHAIN_RIGHT;
        verifying.ty = MID;
        blocks.unshift(verifying);
        verifying = null;
      }
      for (let i = 1; i < blocks.length; i++) blocks[i].tx = CHAIN_RIGHT - i * PITCH;
      // only the confirmed transactions leave the mempool; the rest stay
      for (let i = txs.length - 1; i >= 0; i--) if (txs[i].sel) txs.splice(i, 1);
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

      // mining phase machine — two miners race
      if (st.phase === "idle") {
        if (phaseT >= IDLE_MS && startGather()) {
          st.phase = "gather";
          phaseT = 0;
        }
      } else if (st.phase === "gather") {
        if (formingTop.every((f) => f.filled) && formingBot.every((f) => f.filled)) {
          st.phase = "hash";
          phaseT = 0;
        }
      } else if (st.phase === "hash") {
        if (phaseT >= HASH_MS) {
          st.phase = "found";
          st.winner = Math.random() < 0.5 ? 0 : 1; // first to a valid hash
          phaseT = 0;
        }
      } else if (st.phase === "found") {
        if (phaseT >= FOUND_MS) {
          startVerify(); // winner slides to centre stage
          st.phase = "verify";
          phaseT = 0;
        }
      } else if (st.phase === "verify") {
        if (phaseT >= VERIFY_MS) {
          seal(); // checks passed → join the chain
          st.phase = "idle";
          st.winner = -1;
          phaseT = 0;
        }
      }

      // while hashing, each miner keeps trying nonces → its nonce swatch drifts
      if (st.phase === "hash") {
        nonceTopHue = (nonceTopHue + rnd(4, 12)) % 360;
        nonceBotHue = (nonceBotHue + rnd(4, 12)) % 360;
      }
      // the winning block easing toward centre stage (and later the chain tip)
      if (verifying) {
        const e = Math.min(1, k * 3);
        verifying.x += (verifying.tx - verifying.x) * e;
        verifying.y += (verifying.ty - verifying.y) * e;
      }

      // mempool txs drifting into the pool
      for (const t of txs) {
        if (t.phase === "in") {
          t.x += (t.tx0 - t.x) * Math.min(1, k * 3);
          t.y += (t.ty0 - t.y) * Math.min(1, k * 3);
          if (Math.abs(t.x - t.tx0) < 0.6 && Math.abs(t.y - t.ty0) < 0.6) {
            t.x = t.tx0;
            t.y = t.ty0;
            t.phase = "pool";
          }
        }
        if (t.flash > 0) t.flash -= dt;
      }
      // copies flying from the mempool into BOTH blocks (their colour preserved)
      for (let i = copies.length - 1; i >= 0; i--) {
        const c = copies[i];
        c.x += (c.tx0 - c.x) * Math.min(1, k * 4);
        c.y += (c.ty0 - c.y) * Math.min(1, k * 4);
        if (Math.abs(c.x - c.tx0) < 0.5 && Math.abs(c.y - c.ty0) < 0.5) {
          const fb = c.mb === 0 ? formingTop : formingBot;
          fb[c.slot].fee = c.fee;
          fb[c.slot].filled = true;
          copies.splice(i, 1); // arrived → it becomes the block pixel
        }
      }

      // nodes — roam the top strip, but swarm the block while it's being checked
      for (let idx = 0; idx < nodes.length; idx++) {
        const n = nodes[idx];
        if (st.phase === "verify" && verifying) {
          const ang = (idx / nodes.length) * Math.PI * 2;
          const ox = verifying.x + BLOCK / 2 - 2 + Math.cos(ang) * 24;
          const oy = verifying.y + BLOCK / 2 - 2 + Math.sin(ang) * 20;
          n.x += (ox - n.x) * Math.min(1, k * 4);
          n.y += (oy - n.y) * Math.min(1, k * 4);
          n.target = -1;
          continue;
        }
        n.x += n.vx * k;
        n.y += n.vy * k;
        if (n.x < MEM_X0 - 24 || n.x > CW - 8) n.vx *= -1;
        n.x = Math.max(MEM_X0 - 24, Math.min(CW - 8, n.x));
        if (n.y < 8) {
          n.y = 8;
          n.vy = Math.abs(n.vy);
        } else if (n.y > NODE_Y1) {
          n.vy = -Math.abs(n.vy);
          n.y += (NODE_Y1 - n.y) * Math.min(1, k * 2.5); // ease back after swarming
        }
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

      // chain glide (smooth, in x and y) + cull off-screen
      for (let i = blocks.length - 1; i >= 0; i--) {
        const b = blocks[i];
        const e = Math.min(1, k * 2.4);
        b.x += (b.tx - b.x) * e;
        b.y += (b.ty - b.y) * e;
        if (b.x + BLOCK < -2) blocks.splice(i, 1);
      }
    };

    // ---- crisp drawing helpers (integer-aligned, no AA) ----
    const R = Math.round;
    const S = SCALE;
    const rect = (x: number, y: number, w: number, h: number, c: string) => {
      ctx.fillStyle = c;
      ctx.fillRect(R(x * S), R(y * S), R(w * S), R(h * S));
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
        if (i++ % 2 === 0) ctx.fillRect(X * S, Y * S, S, S);
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
    // two swatches sitting on top of a block: prev-block-hash (left) + nonce (right)
    const header = (x: number, y: number, ph: string, nonce: string) => {
      rect(x + 1, y - 5, 12, 3, ph);
      rect(x + 15, y - 5, 12, 3, nonce);
    };
    // 1px rectangle outline (rectangular sibling of frame)
    const box = (x: number, y: number, w: number, h: number, c: string) => {
      rect(x, y, w, 1, c);
      rect(x, y + h - 1, w, 1, c);
      rect(x, y, 1, h, c);
      rect(x + w - 1, y, 1, h, c);
    };

    // centre of the part the nodes are currently checking (0 prev-hash, 1 nonce, 2 txs)
    const partPt = (v: Blk, s: number): [number, number] =>
      s <= 0 ? [v.x + 7, v.y - 4] : s === 1 ? [v.x + 21, v.y - 4] : [v.x + BLOCK / 2, v.y + BLOCK / 2];

    const draw = () => {
      ctx.clearRect(0, 0, CW * S, CH * S);
      const hov = hoveredRef.current;
      // which of the 3 parts is under inspection this frame (-1 when not verifying)
      const checkStage = st.phase === "verify" ? Math.min(2, Math.floor(phaseT / (VERIFY_MS / 3))) : -1;

      // mempool pixels (selected ones stay put — they're copied, not removed)
      for (const t of txs) {
        rect(t.x, t.y, PX, PX, t.flash > 0 ? "#eef3ee" : feeToColor(t.fee));
      }

      // node robots + scan beams (aim at the block under check while verifying)
      for (const n of nodes) {
        if (verifying && checkStage >= 0) {
          const [px, py] = partPt(verifying, checkStage);
          pixLine(n.x + 2, n.y + 4, px, py, "rgba(91,155,213,0.85)");
        } else if (n.target >= 0 && txs[n.target] && txs[n.target].phase === "pool") {
          pixLine(n.x + 2, n.y + 4, txs[n.target].x + 1, txs[n.target].y + 1, "rgba(91,155,213,0.7)");
        }
        rect(n.x, n.y, 4, 4, blue);
        rect(n.x, n.y - 1, 1, 1, faint);
        rect(n.x + 3, n.y - 1, 1, 1, faint);
        rect(n.x + 1, n.y + 1, 1, 1, accent);
      }

      // transactions copied toward both blocks (their mempool colour preserved)
      for (const c of copies) rect(c.x, c.y, PX, PX, feeToColor(c.fee));

      // two miners racing — top (green), bottom (blue) — always on screen
      const hashing = st.phase === "hash";
      const won = st.phase === "found";
      const idle = st.phase === "idle" || st.phase === "verify"; // race over → dim the miners
      const topC = idle ? "#26352e" : won ? (st.winner === 0 ? green : "#26352e") : green;
      const botC = idle ? "#223038" : won ? (st.winner === 1 ? blue : "#223038") : blue;
      blockPixels(ABX, TOPB, formingTop.map((f) => f.fee), (i) => formingTop[i].filled);
      frame(ABX, TOPB, BLOCK, topC);
      header(ABX, TOPB, hsl(roundPHHue, 52, 50), hsl(nonceTopHue, 62, 56)); // same prev-hash, own nonce
      blockPixels(ABX, BOTB, formingBot.map((f) => f.fee), (i) => formingBot[i].filled);
      frame(ABX, BOTB, BLOCK, botC);
      header(ABX, BOTB, hsl(roundPHHue, 52, 50), hsl(nonceBotHue, 62, 56));
      // miner glyphs (pickaxe), animated while hashing
      const tick = hashing && R(phaseT / 70) % 2 ? 1 : 0;
      rect(ABX - 7, TOPB + BLOCK / 2 - 2 + tick, 3, 3, topC);
      rect(ABX - 9, TOPB + BLOCK / 2 + 2, 6, 1, topC);
      rect(ABX - 7, BOTB + BLOCK / 2 - 2 + tick, 3, 3, botC);
      rect(ABX - 9, BOTB + BLOCK / 2 + 2, 6, 1, botC);

      // chain blocks (winner's colour outline) + 1px links
      for (let i = blocks.length - 1; i >= 0; i--) {
        const b = blocks[i];
        blockPixels(b.x, b.y, b.pixels);
        frame(b.x, b.y, BLOCK, b.color);
        header(b.x, b.y, b.ph, b.nonce);
        const right = blocks[i - 1];
        const rightX = right ? right.x : -999;
        if (rightX > b.x) {
          const lx = b.x + BLOCK;
          const lw = rightX - lx;
          if (lw > 0 && lw <= LINK + 2) rect(lx, MID + Math.floor(BLOCK / 2) - 1, lw, 1, accent); // 1px chain link
        }
      }

      // the winning block at centre stage, nodes checking its 3 parts in turn
      if (verifying) {
        const v = verifying;
        blockPixels(v.x, v.y, v.pixels);
        frame(v.x, v.y, BLOCK, v.color);
        header(v.x, v.y, v.ph, v.nonce);
        const pulse = R(phaseT / 90) % 2 === 0;
        const regions: [number, number, number, number][] = [
          [v.x, v.y - 6, 14, 5], // prev-hash swatch
          [v.x + 14, v.y - 6, 14, 5], // nonce swatch
          [v.x, v.y, BLOCK, BLOCK], // the transactions
        ];
        for (let s = 0; s < 3; s++) {
          const [bx, by, bw, bh] = regions[s];
          if (s < checkStage) box(bx, by, bw, bh, green); // passed
          else if (s === checkStage) box(bx, by, bw, bh, pulse ? "#eef3ee" : accent); // checking now
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
  }, [reduced, intro]);

  const eff: Region | null = hovered ?? (intro ? null : tour);
  const info = eff ? MAP[eff] : null;

  return (
    <div ref={wrapRef} className="w-full" data-no-swipe>
      <div className="relative w-full overflow-hidden border border-border bg-bg" style={{ aspectRatio: `${CW} / ${CH}` }}>
        <canvas
          ref={canvasRef}
          width={CW * SCALE}
          height={CH * SCALE}
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
          {/* two-miner race readout, centred over the assembly */}
          <span
            className="absolute -translate-x-1/2 whitespace-nowrap text-center"
            style={{ left: `${(ASSEM_X / CW) * 100}%`, top: "2%" }}
          >
            {status.phase === "hash" && <span className="text-accent">⛏ two miners racing for the block…</span>}
            {status.phase === "found" &&
              (status.winner === 0 ? (
                <span className="text-green">✓ green miner found a valid hash</span>
              ) : (
                <span className="text-blue">✓ blue miner found a valid hash</span>
              ))}
            {status.phase === "verify" && <span className="text-accent">nodes checking: prev-hash · nonce · transactions →</span>}
            {status.phase === "gather" && <span className="text-muted">packing transactions…</span>}
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
      return { x: 0, y: MID - 6, w: CHAIN_RIGHT - LINK, h: BLOCK + 12 };
    case "link":
      return { x: CHAIN_RIGHT - LINK - 2, y: MID + BLOCK / 2 - 7, w: LINK + 6, h: 14 };
    case "block":
      return { x: ABX - 3, y: TOPB - 6, w: BLOCK + 6, h: BOTB + BLOCK - TOPB + 9 };
    case "miner":
      return { x: ABX - 12, y: TOPB - 2, w: 12, h: BOTB + BLOCK - TOPB + 4 };
    case "mempool":
      return { x: MEM_X0 - 6, y: MEM_Y0 - 2, w: CW - MEM_X0 + 6, h: CH - MEM_Y0 };
    case "nodes":
      return { x: MEM_X0 - 26, y: 0, w: CW - MEM_X0 + 26, h: NODE_Y1 + 4 };
  }
}
