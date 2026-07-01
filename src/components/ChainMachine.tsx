"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
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
const LINK = 8; // chain-link gap; tighter so more blocks fit and one always
const PITCH = BLOCK + LINK; // bleeds off the left edge (history continues off-screen)

const ASSEM_X = 208;
const ASSEM_Y = 96;
const CHAIN_RIGHT = 168;
const MEM_X0 = 252;
const MEM_Y0 = 78;
const NODE_Y1 = 70;
const MID = ASSEM_Y - BLOCK / 2; // the chain row (block top)
const TOPB = MID - 38; // top miner block (magenta)
const BOTB = MID + 38; // bottom miner block (blue)
const ABX = ASSEM_X - BLOCK / 2; // assembly block x
const VERIFY_X = 210; // centre stage where the winning block is checked before joining
const MAGENTA = "#d6409f"; // top miner colour (green is reserved for fees / "ok" states)

// broad regions (used for keyboard focus) + precise things you can hover
type Region = "chain" | "link" | "block" | "miner" | "mempool" | "nodes";
type InfoKey = Region | "tx" | "hashTx" | "hashPow";
// a precise hit under the pointer: what it is (+ its fee for a tx) and its outline box.
// `broad` marks an area fall-back (draw a soft outline instead of a tight one).
type HoverHit = { kind: InfoKey; fee?: number; broad?: boolean; x: number; y: number; w: number; h: number };

const MAP: Record<InfoKey, { title: string; term: string; body: string }> = {
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
    body: "Two miners (magenta on top, blue below) each pack a block and guess hashes as fast as they can. Each picks the top-fee transactions, so their blocks are almost identical — just a few differ. Whoever finds a valid hash first wins; their block is added, and the loser's leftover transactions drop back into the mempool.",
  },
  block: {
    title: "a block",
    term: "a batch of transactions",
    body: "Each pixel is one transaction. The two little barcodes on top are hashes — a hash is a long string of values, drawn here as a strip of colours. The left, greyscale one is a fingerprint of the block's transactions (just a plain hash). The right one is the block's own hash, which the miner scrambles by trying nonces; it only counts as valid once it starts with a run of zeros — the white bars — which is the work miners race to find.",
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
  tx: {
    title: "a transaction",
    term: "one unconfirmed payment",
    body: "A single payment, broadcast to the network and waiting to be picked. Its colour is its fee rate — warmer pays more and gets chosen sooner.",
  },
  hashTx: {
    title: "the transactions hash",
    term: "a fingerprint of the block's contents",
    body: "One short hash summarising every transaction in the block. Change any transaction and this fingerprint changes completely — that's how tampering is caught. A plain hash, so no leading zeros.",
  },
  hashPow: {
    title: "the block hash",
    term: "the proof-of-work",
    body: "The block's own hash. The miner keeps changing the nonce until this comes out starting with a run of zeros — the white bars. Finding one is the 'work'; verifying it is instant.",
  },
};

// order doubles as the outro tour sequence AND the hit-rect stacking order (later =
// on top): broad areas first, then the chain/link so the tip reads as chain, not miner
const REGION_ORDER: Region[] = ["mempool", "nodes", "miner", "block", "chain", "link"];

type Tx = {
  x: number;
  y: number;
  tx0: number;
  ty0: number;
  fee: number;
  phase: "in" | "pool";
  slot: number;
  flash: number;
};
// a transaction copied toward one miner's block (preserves the tx colour): it
// flies up from the mempool, then falls and stacks into the block, tetris-style.
type Copy = {
  x: number;
  y: number;
  cx: number; // target column x
  fee: number;
  mb: 0 | 1; // which miner's block
  col: number; // which column it drops into
  delay: number; // ms before it leaves the mempool (staggers the stream)
  phase: "wait" | "fly" | "fall";
  vy: number; // fall velocity
};
// a celebratory pixel spark, burst when a miner wins the block
type Spark = { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string };
// a block header: ph = prev-block-hash barcode (fixed), nonce = the nonce barcode.
// each is a little strip of colour bars, standing in for a hash's many hex digits.
type Blk = { x: number; tx: number; y: number; ty: number; color: string; pixels: number[]; ph: string[]; nonce: string[] };
type Node = { x: number; y: number; vx: number; vy: number };
type Status = { phase: "idle" | "gather" | "hash" | "found" | "verify"; winner: number }; // winner: -1 none, 0 magenta, 1 blue

const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const randFee = (intro: boolean) => Math.random() ** 2 * (intro ? 40 : 130) + 1;
// header swatches stand in for the 256-bit header fields, shown as colour
const hsl = (h: number, s: number, l: number) => `hsl(${Math.round(h)}, ${s}%, ${l}%)`;
const randHue = () => Math.random() * 360;
const HBARS = 12; // many thin bars per hash field — a hash is a long, complex value
const ZEROS = 3; // leading white bars = the leading zeros that make a MINED hash valid
const WHITE = "#ffffff"; // a "zero" digit
// RIGHT field = the mined hash (colour): scrambles, and gains `zeros` leading white
// bars when valid. LEFT field = a plain hash of the transactions (grayscale): just a
// fingerprint, so no white and no leading zeros — keeps it distinct from the mined one.
const makeBars = (zeros = 0) => Array.from({ length: HBARS }, (_, i) => (i < zeros ? WHITE : hsl(randHue(), 55 + Math.random() * 25, 46 + Math.random() * 20)));
const makeGreyBars = () => Array.from({ length: HBARS }, () => hsl(0, 0, 30 + Math.random() * 40));

export default function ChainMachine({ mode }: { mode: "intro" | "outro" }) {
  const intro = mode === "intro";
  const [hovered, setHovered] = useState<{ kind: InfoKey; fee?: number } | null>(null);
  const [tour, setTour] = useState<Region | null>(intro ? null : "mempool");
  const [minted, setMinted] = useState(intro ? 0 : 11);
  const [reduced, setReduced] = useState(false);
  const [status, setStatus] = useState<Status>({ phase: "idle", winner: -1 });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const visibleRef = useRef(true);
  const mouseRef = useRef<{ x: number; y: number } | null>(null); // pointer, in logical coords
  const hoverHitRef = useRef<HoverHit | null>(null); // precise element under the pointer (for the outline)
  const statusRef = useRef<Status>({ phase: "idle", winner: -1 });

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
    const io = new IntersectionObserver((e) => (visibleRef.current = e[0].isIntersecting), { threshold: 0 });
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

  // mirror the mining status into React for the overlay — only when it actually
  // changes, so we don't re-render the whole component 10×/second for nothing
  useEffect(() => {
    let lastPhase = "";
    let lastWinner = -2;
    const id = setInterval(() => {
      if (!visibleRef.current) return;
      const s = statusRef.current;
      if (s.phase !== lastPhase || s.winner !== lastWinner) {
        lastPhase = s.phase;
        lastWinner = s.winner;
        setStatus({ phase: s.phase, winner: s.winner });
      }
    }, 100);
    return () => clearInterval(id);
  }, []);

  // simulation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    const accent = "#f7931a";
    const magenta = MAGENTA; // top miner
    const blue = "#5b9bd5"; // bottom miner
    const green = "#43c98b"; // reserved for "check passed" ticks
    const faint = "#5a6170";

    const memCols = Math.floor((CW - MEM_X0 - 2) / TX);
    const memRows = Math.floor((CH - MEM_Y0 - 2) / TX);
    const memCap = memCols * memRows;
    // keep the visible pile to a few rows — enough to always fill a block, but it
    // never grows tall enough to overflow into the chain or to tank the framerate
    const memTarget = Math.min(memCap, memCols * 4);
    const memSlot = (i: number) => ({
      x: MEM_X0 + (i % memCols) * TX,
      y: CH - 2 - (Math.floor(i / memCols) + 1) * TX,
    });

    const txs: Tx[] = [];
    const copies: Copy[] = [];
    const sparks: Spark[] = [];
    const blocks: Blk[] = [];
    const formingTop = Array.from({ length: TOTAL }, () => ({ fee: 0, filled: false }));
    const formingBot = Array.from({ length: TOTAL }, () => ({ fee: 0, filled: false }));
    // how many transactions have stacked in each column (for tetris-style fill)
    const stackTop = Array.from({ length: BN }, () => 0);
    const stackBot = Array.from({ length: BN }, () => 0);
    const STAGGER = 16; // ms between transactions leaving the mempool
    const GRAV = 1500; // fall acceleration (px/s²)

    // header barcodes — prev-hash is shared by both miners (same chain tip) and
    // stays fixed for the round; each miner's nonce barcode scrambles while it hashes.
    let roundPHbars = makeGreyBars(); // hash of the transactions — grayscale, no zeros
    let nonceTopBars = makeBars();
    let nonceBotBars = makeBars();
    // the winning block, after it leaves a miner and before it joins the chain:
    // it slides to centre stage where the nodes check its 3 parts.
    let verifying: Blk | null = null;
    // the few transactions unique to each miner's block (the realistic diff) — the
    // LOSER's set drops back into the mempool once the winner is decided.
    let diffTop: number[] = [];
    let diffBot: number[] = [];

    const nodes: Node[] = Array.from({ length: intro ? 3 : 4 }, () => ({
      x: rnd(MEM_X0 - 24, CW - 8),
      y: rnd(8, NODE_Y1),
      vx: rnd(-11, 11),
      vy: rnd(-7, 7),
    }));

    // seed history (alternating winner colours), each with its own header swatches
    for (let i = 0; i < (intro ? 6 : 8); i++) {
      const x = CHAIN_RIGHT - i * PITCH;
      blocks.push({ x, tx: x, y: MID, ty: MID, color: i % 2 ? blue : magenta, pixels: Array.from({ length: TOTAL }, () => randFee(intro)), ph: makeGreyBars(), nonce: makeBars(ZEROS) });
    }
    // seed a visible mempool pile
    const seedPool = Math.min(memTarget, intro ? 150 : 190);
    for (let i = 0; i < seedPool; i++) {
      const s = memSlot(i);
      txs.push({ x: s.x, y: s.y, tx0: s.x, ty0: s.y, fee: randFee(intro), phase: "pool", slot: i, flash: 0 });
    }

    let spawnAcc = 0;
    let phaseT = 0;
    let scrambleT = 0; // throttles the nonce-barcode scramble while hashing
    let swingT = 0; // drives the pickaxe swing while hashing
    const SWING_MS = 340; // one full pickaxe swing (chop at the midpoint)
    const st = statusRef.current;
    st.phase = "idle";
    // a miner confirms TOTAL txs each full cycle (~9.3s intro / ~6.5s outro), so
    // spawn at roughly that rate — the pool stays level instead of piling to the cap
    const spawnEvery = intro ? 245 : 170;
    const IDLE_MS = intro ? 2600 : 1500;
    const HASH_MS = intro ? 2800 : 1900;
    const FOUND_MS = 850;
    const VERIFY_MS = intro ? 2100 : 1500; // nodes check the 3 parts in sequence (~700ms each)

    // add a transaction to the pool, flying in from (fromX, fromY) to a free slot
    const addPoolTx = (fee: number, fromX: number, fromY: number) => {
      if (txs.length >= memTarget) return;
      const occ = new Set(txs.map((t) => t.slot));
      let i = 0;
      while (occ.has(i) && i < memTarget) i++;
      const s = memSlot(i);
      txs.push({ x: fromX, y: fromY, tx0: s.x, ty0: s.y, fee, phase: "in", slot: i, flash: 0 });
    };
    const spawnTx = () => addPoolTx(randFee(intro), CW + rnd(2, 26), rnd(MEM_Y0, CH - 6));

    const vary = (f: number) => Math.max(1, f * (1 + (Math.random() - 0.5) * 0.16)); // very similar, tiny bit different
    const DIFF = 4; // how many transactions differ between the two miners' blocks
    const startGather = () => {
      const pool = txs.filter((t) => t.phase === "pool");
      if (pool.length < TOTAL + DIFF) return false;
      pool.sort((a, b) => b.fee - a.fee);
      formingTop.forEach((f) => ((f.fee = 0), (f.filled = false)));
      formingBot.forEach((f) => ((f.fee = 0), (f.filled = false)));
      stackTop.fill(0);
      stackBot.fill(0);
      roundPHbars = makeGreyBars(); // new round → fresh transactions hash (grayscale, no zeros)
      nonceTopBars = makeBars(); // both miners start searching again — no leading zeros yet
      nonceBotBars = makeBars();
      copies.length = 0;
      // both miners grab the top-fee transactions, so they mostly agree — but at
      // the margin each keeps a few the other doesn't (a realistic, almost-same diff)
      const shared = pool.slice(0, TOTAL - DIFF); // in both blocks
      const uniqTop = pool.slice(TOTAL - DIFF, TOTAL); // only the top miner's block
      const uniqBot = pool.slice(TOTAL, TOTAL + DIFF); // only the bottom miner's block
      diffTop = uniqTop.map((t) => t.fee);
      diffBot = uniqBot.map((t) => t.fee);
      // ONE shuffled column bag, shared by both blocks → identical layout, so the
      // blocks look almost the same (only the diff cells hold different txs)
      const bag: number[] = [];
      for (let col = 0; col < BN; col++) for (let r = 0; r < BN; r++) bag.push(col);
      for (let i = bag.length - 1; i > 0; i--) {
        const j = (Math.random() * (i + 1)) | 0;
        [bag[i], bag[j]] = [bag[j], bag[i]];
      }
      const topTxs = shared.concat(uniqTop);
      const botTxs = shared.concat(uniqBot);
      const launch = (t: Tx, mb: 0 | 1, k: number) =>
        copies.push({ x: t.x, y: t.y, cx: ABX + 2 + bag[k] * TX, fee: vary(t.fee), mb, col: bag[k], delay: k * STAGGER, phase: "wait", vy: 0 });
      topTxs.forEach((t, k) => launch(t, 0, k));
      botTxs.forEach((t, k) => launch(t, 1, k));
      // the picked transactions actually LEAVE the mempool (they're flying copies now)
      const taken = new Set<Tx>([...shared, ...uniqTop, ...uniqBot]);
      for (let i = txs.length - 1; i >= 0; i--) if (taken.has(txs[i])) txs.splice(i, 1);
      return true;
    };

    // burst a shower of pixel sparks out of a point — fired when a miner wins
    const burstSparks = (cx: number, cy: number, color: string) => {
      for (let i = 0; i < 44; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = rnd(30, 150);
        const life = rnd(700, 1600);
        const r = Math.random();
        const c = r < 0.4 ? "#eef3ee" : r < 0.7 ? color : accent; // sparkle, winner colour, accent
        sparks.push({ x: cx, y: cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - rnd(10, 55), life, max: life, color: c });
      }
    };

    // one or two tiny sparks where a pickaxe strikes
    const strikeSparks = (cx: number, cy: number) => {
      const nn = 1 + ((Math.random() * 2) | 0);
      for (let i = 0; i < nn; i++) {
        const a = -Math.PI / 2 + rnd(-0.9, 0.9); // fly upward-ish off the strike
        const sp = rnd(18, 46);
        const life = rnd(180, 380);
        sparks.push({ x: cx, y: cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life, max: life, color: Math.random() < 0.5 ? "#eef3ee" : accent });
      }
    };

    // promote the winning miner block to centre stage for verification
    const startVerify = () => {
      const wf = st.winner === 0 ? formingTop : formingBot;
      const color = st.winner === 0 ? magenta : blue;
      const startY = st.winner === 0 ? TOPB : BOTB;
      const nb = st.winner === 0 ? nonceTopBars : nonceBotBars; // the winning nonce, frozen
      verifying = { x: ABX, tx: VERIFY_X, y: startY, ty: MID, color, pixels: wf.map((f) => f.fee), ph: roundPHbars.slice(), nonce: nb.slice() };
      formingTop.forEach((f) => ((f.fee = 0), (f.filled = false)));
      formingBot.forEach((f) => ((f.fee = 0), (f.filled = false)));
      copies.length = 0;
      // the loser's block is abandoned — its unique transactions weren't confirmed,
      // so they fall back into the mempool from the losing block
      const lost = st.winner === 0 ? diffBot : diffTop;
      const loserY = (st.winner === 0 ? BOTB : TOPB) + BLOCK / 2;
      lost.forEach((fee) => addPoolTx(fee, ABX + BLOCK / 2, loserY));
      diffTop = [];
      diffBot = [];
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
      // the confirmed transactions already left the pool when they were picked
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
          // the winning hash now starts with the required leading zeros (white bars);
          // the loser's stays random (it never hit the target)
          if (st.winner === 0) nonceTopBars = makeBars(ZEROS);
          else nonceBotBars = makeBars(ZEROS);
          const wy = st.winner === 0 ? TOPB : BOTB;
          if (!reduced) burstSparks(ABX + BLOCK / 2, wy + BLOCK / 2, st.winner === 0 ? magenta : blue); // celebrate the win (skip under reduce-motion)
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

      // while hashing, each miner keeps trying nonces → its barcode scrambles
      // (throttled so it reads as searching, not strobing; skipped for reduce-motion)
      if (st.phase === "hash" && !reduced) {
        scrambleT += dt;
        if (scrambleT >= 100) {
          scrambleT = 0;
          nonceTopBars = makeBars();
          nonceBotBars = makeBars();
        }
      }
      // pickaxe swing — advance it while hashing and throw sparks at each strike (midpoint)
      if (st.phase === "hash") {
        const prevP = (swingT % SWING_MS) / SWING_MS;
        swingT += dt;
        const p = (swingT % SWING_MS) / SWING_MS;
        if (prevP < 0.5 && p >= 0.5 && !reduced) {
          // sparks fly off the pickaxe HEAD where it meets the block's left edge
          strikeSparks(ABX - 1, TOPB + BLOCK / 2 - 2);
          strikeSparks(ABX - 1, BOTB + BLOCK / 2 - 2);
        }
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
      // copies leave the mempool, fly above their column, then FALL and stack
      // into BOTH blocks (their colour preserved for continuity)
      for (let i = copies.length - 1; i >= 0; i--) {
        const c = copies[i];
        if (c.phase === "wait") {
          c.delay -= dt;
          if (c.delay <= 0) c.phase = "fly";
          continue;
        }
        const blockTop = c.mb === 0 ? TOPB : BOTB;
        if (c.phase === "fly") {
          const fy = blockTop - 9; // hover just above the block, lined up with the column
          c.x += (c.cx - c.x) * Math.min(1, k * 6);
          c.y += (fy - c.y) * Math.min(1, k * 6);
          if (Math.abs(c.x - c.cx) < 0.9 && Math.abs(c.y - fy) < 1.5) {
            c.phase = "fall";
            c.x = c.cx;
            c.vy = 0;
          }
        } else {
          // gravity: fall straight down onto the top of this column's stack
          const sh = c.mb === 0 ? stackTop : stackBot;
          if (sh[c.col] >= BN) {
            copies.splice(i, 1); // column full (shouldn't happen) — safety
            continue;
          }
          c.x = c.cx;
          c.vy += GRAV * k;
          c.y += c.vy * k;
          const row = BN - 1 - sh[c.col];
          const floorY = blockTop + 2 + row * TX;
          if (c.y >= floorY) {
            const fb = c.mb === 0 ? formingTop : formingBot;
            const idx = row * BN + c.col;
            fb[idx].fee = c.fee;
            fb[idx].filled = true;
            sh[c.col]++;
            copies.splice(i, 1); // landed → it becomes the block pixel
          }
        }
      }

      // winner sparks — fly out and fall, fading as they go
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i];
        s.vy += 90 * k; // gentle gravity
        s.x += s.vx * k;
        s.y += s.vy * k;
        s.life -= dt;
        if (s.life <= 0) sparks.splice(i, 1);
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
    // two little barcodes on top of a block: prev-block-hash (left) + nonce (right),
    // each a strip of HBARS colour bars evoking a hash's many varied digits
    const HBW = 12 / HBARS; // width of one bar
    const header = (x: number, y: number, ph: string[], nonce: string[]) => {
      for (let i = 0; i < HBARS; i++) rect(x + 1 + i * HBW, y - 5, HBW, 3, ph[i]);
      for (let i = 0; i < HBARS; i++) rect(x + 15 + i * HBW, y - 5, HBW, 3, nonce[i]);
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
      // which of the 3 parts is under inspection this frame (-1 when not verifying)
      const checkStage = st.phase === "verify" ? Math.min(2, Math.floor(phaseT / (VERIFY_MS / 3))) : -1;

      // mempool pixels. skip anything still off-screen (e.g. spawning in / returning)
      for (const t of txs) {
        if (t.x >= CW || t.x <= -TX || t.y >= CH || t.y <= -TX) continue;
        rect(t.x, t.y, PX, PX, t.flash > 0 ? "#eef3ee" : feeToColor(t.fee));
      }

      // (node robots are drawn later, on top of the blocks, so while verifying they
      // hover in front of the winning block instead of vanishing behind it)

      // two miners racing — top (magenta), bottom (blue) — always on screen
      const hashing = st.phase === "hash";
      // the miners keep their colours at all times — magenta on top, blue below —
      // so they never grey out or disappear between rounds
      const topC = magenta;
      const botC = blue;
      blockPixels(ABX, TOPB, formingTop.map((f) => f.fee), (i) => formingTop[i].filled);
      frame(ABX, TOPB, BLOCK, topC);
      header(ABX, TOPB, roundPHbars, nonceTopBars); // same prev-hash, own nonce
      blockPixels(ABX, BOTB, formingBot.map((f) => f.fee), (i) => formingBot[i].filled);
      frame(ABX, BOTB, BLOCK, botC);
      header(ABX, BOTB, roundPHbars, nonceBotBars);
      // miner pickaxe — the actual ⛏ glyph, rotated to swing up and chop down while
      // hashing (pivots around the hand at its lower end)
      {
        const s = hashing ? -Math.cos(((swingT % SWING_MS) / SWING_MS) * Math.PI * 2) : -0.6; // -1 raised … +1 chop
        const phi = 0.15 + s * 0.7; // swing rotation
        ctx.save();
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = `${10 * S}px system-ui, "Segoe UI Symbol", sans-serif`;
        const drawPick = (cy: number, color: string) => {
          ctx.save();
          ctx.translate((ABX - 7) * S, (cy + 3) * S); // hand pivot, lower-left of the block
          ctx.rotate(phi);
          ctx.fillStyle = color;
          ctx.fillText("⛏︎", 0, -4 * S); // glyph sits above the pivot; ︎ = flat/tintable
          ctx.restore();
        };
        drawPick(TOPB + BLOCK / 2, topC);
        drawPick(BOTB + BLOCK / 2, botC);
        ctx.restore();
      }

      // transactions being taken to the blocks, drawn on top (mempool colour kept).
      // no worker tag — the destination block already shows which miner grabs it.
      for (const c of copies) rect(c.x, c.y, PX, PX, feeToColor(c.fee));

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

      // scan beams — drawn on top of the blocks so a checking node hovers in front
      // of the winning block rather than slipping behind it.
      if (verifying && checkStage >= 0) {
        // verifying: every node fixes its attention on the part being checked
        const [px, py] = partPt(verifying, checkStage);
        for (const n of nodes) pixLine(n.x + 2, n.y + 4, px, py, "rgba(91,155,213,0.4)");
      } else {
        // faint rays only for INCOMING transactions — the checking is shared across
        // all nodes (assigned by slot) so no single node does all the work
        for (const t of txs) {
          if (t.phase !== "in" || t.x >= CW || t.x <= -TX) continue;
          const n = nodes[t.slot % nodes.length];
          pixLine(n.x + 2, n.y + 4, t.x + 1, t.y + 1, "rgba(122,201,240,0.4)");
        }
      }

      // attention ray from the grey prev-hash barcode to the block it's calculated
      // from (the current chain tip) — shows the hash links back to that block
      const tip = blocks[0];
      if (tip) {
        const tcx = tip.x + BLOCK / 2;
        const tcy = tip.y + BLOCK / 2;
        const phRay = (bx: number, by: number) => pixLine(bx + 7, by - 4, tcx, tcy, "rgba(180,180,180,0.5)");
        if (verifying) phRay(verifying.x, verifying.y);
        else if (st.phase === "gather" || st.phase === "hash" || st.phase === "found") {
          phRay(ABX, TOPB);
          phRay(ABX, BOTB);
        }
      }
      // node bodies (on top of their own beams)
      for (const n of nodes) {
        rect(n.x, n.y, 4, 4, blue);
        rect(n.x, n.y - 1, 1, 1, faint);
        rect(n.x + 3, n.y - 1, 1, 1, faint);
        rect(n.x + 1, n.y + 1, 1, 1, accent);
      }

      // winner sparks on top, fading out over their life
      if (sparks.length) {
        for (const s of sparks) {
          ctx.globalAlpha = Math.max(0, Math.min(1, s.life / s.max));
          rect(s.x, s.y, 1, 1, s.color);
        }
        ctx.globalAlpha = 1;
      }

      // hover highlight — a crisp outline hugging the exact element under the pointer,
      // or a soft dim outline for a broad area fall-back
      const hh = hoverHitRef.current;
      if (hh) {
        if (hh.broad) {
          ctx.globalAlpha = 0.28;
          box(hh.x, hh.y, hh.w, hh.h, accent);
          ctx.globalAlpha = 1;
        } else {
          box(hh.x, hh.y, hh.w, hh.h, R(phaseT / 120) % 2 === 0 ? accent : "#ffd08a"); // gentle game-y pulse
        }
      }
    };

    // precise, game-like hit-test: what specific thing is under the pointer right now
    const hitTest = (mx: number, my: number): HoverHit | null => {
      // 1. a node robot (small, sits on top)
      for (const n of nodes) {
        if (mx >= n.x - 2 && mx <= n.x + 6 && my >= n.y - 2 && my <= n.y + 6) return { kind: "nodes", x: n.x - 2, y: n.y - 2, w: 8, h: 8 };
      }
      // 2. a header hash bar on any block — left (transactions) vs right (mined)
      const hashHit = (bx: number, by: number): HoverHit | null => {
        if (my < by - 7 || my > by - 1) return null;
        if (mx >= bx && mx <= bx + 13) return { kind: "hashTx", x: bx, y: by - 6, w: 13, h: 5 };
        if (mx >= bx + 14 && mx <= bx + 27) return { kind: "hashPow", x: bx + 14, y: by - 6, w: 13, h: 5 };
        return null;
      };
      let hh = hashHit(ABX, TOPB) || hashHit(ABX, BOTB) || (verifying ? hashHit(verifying.x, verifying.y) : null);
      if (!hh) for (const b of blocks) if ((hh = hashHit(b.x, b.y))) break;
      if (hh) return hh;
      // 3. a pickaxe (the worker) to the left of each racing block
      const pickHit = (cy: number): HoverHit | null =>
        mx >= ABX - 17 && mx <= ABX - 1 && my >= cy - 13 && my <= cy + 11 ? { kind: "miner", x: ABX - 17, y: cy - 13, w: 16, h: 24 } : null;
      const ph = pickHit(TOPB + BLOCK / 2) || pickHit(BOTB + BLOCK / 2);
      if (ph) return ph;
      // 4. a racing / centre-stage block
      const inBlock = (bx: number, by: number) => mx >= bx && mx <= bx + BLOCK && my >= by && my <= by + BLOCK;
      if (inBlock(ABX, TOPB)) return { kind: "block", x: ABX, y: TOPB, w: BLOCK, h: BLOCK };
      if (inBlock(ABX, BOTB)) return { kind: "block", x: ABX, y: BOTB, w: BLOCK, h: BLOCK };
      if (verifying && inBlock(verifying.x, verifying.y)) return { kind: "block", x: verifying.x, y: verifying.y, w: BLOCK, h: BLOCK };
      // 5. a sealed chain block, or a link between two of them
      for (let i = 0; i < blocks.length; i++) {
        const b = blocks[i];
        if (inBlock(b.x, b.y)) return { kind: "chain", x: b.x, y: b.y, w: BLOCK, h: BLOCK };
        const younger = blocks[i - 1];
        if (younger) {
          const lx0 = b.x + BLOCK;
          if (younger.x > lx0 && mx >= lx0 - 1 && mx <= younger.x + 1 && Math.abs(my - (MID + BLOCK / 2)) <= 4)
            return { kind: "link", x: lx0, y: MID + BLOCK / 2 - 3, w: younger.x - lx0, h: 6 };
        }
      }
      // 6. an individual mempool transaction
      for (const t of txs) {
        if (t.x >= CW || t.x <= -TX) continue;
        if (mx >= t.x - 0.5 && mx <= t.x + PX + 0.5 && my >= t.y - 0.5 && my <= t.y + PX + 0.5) return { kind: "tx", fee: t.fee, x: t.x - 1, y: t.y - 1, w: PX + 2, h: PX + 2 };
      }
      // 7. otherwise fall back to the surrounding area (a soft outline, not a hard box)
      for (const r of ["mempool", "nodes", "chain"] as Region[]) {
        const z = zone(r);
        if (mx >= z.x && mx <= z.x + z.w && my >= z.y && my <= z.y + z.h) return { kind: r, broad: true, ...z };
      }
      return null;
    };

    let lastHoverSig = "";
    let raf = 0;
    let last = 0;
    let acc = 0;
    const FRAME = 1000 / 60; // cap the sim+draw at ~60fps regardless of refresh rate

    const loop = (t: number) => {
      raf = requestAnimationFrame(loop);
      if (!visibleRef.current) {
        last = t;
        acc = 0;
        return;
      }
      if (!last) last = t;
      const elapsed = t - last;
      last = t;
      // throttle work to ~60fps on high-refresh / uncapped displays (the rAF
      // callback can fire 120–480×/s; running step+draw that often is wasteful)
      acc += elapsed > 250 ? FRAME : elapsed; // a long gap = backgrounded, don't catch up
      if (acc < FRAME) return;
      const dt = Math.min(60, acc);
      acc = Math.min(acc - FRAME, FRAME);
      step(dt);
      // resolve what the pointer is over against the live positions, then draw
      const m = mouseRef.current;
      if (m) {
        const hit = hitTest(m.x, m.y);
        hoverHitRef.current = hit;
        const sig = hit ? `${hit.kind}:${hit.fee != null ? Math.round(hit.fee) : ""}` : "";
        if (sig !== lastHoverSig) {
          lastHoverSig = sig;
          setHovered(hit ? { kind: hit.kind, fee: hit.fee } : null);
        }
      } else {
        hoverHitRef.current = null;
        lastHoverSig = "";
      }
      draw();
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [reduced, intro]);

  const eff: InfoKey | null = hovered?.kind ?? (intro ? null : tour);
  const info = eff ? MAP[eff] : null;

  const onPointer = (e: ReactPointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    mouseRef.current = { x: ((e.clientX - r.left) / r.width) * CW, y: ((e.clientY - r.top) / r.height) * CH };
  };

  return (
    <div ref={wrapRef} className="w-full" data-no-swipe>
      <div
        className="relative w-full cursor-crosshair overflow-hidden border border-border bg-bg"
        style={{ aspectRatio: `${CW} / ${CH}` }}
        onPointerMove={onPointer}
        onPointerDown={onPointer}
        onPointerLeave={() => {
          mouseRef.current = null;
          setHovered(null);
        }}
      >
        <canvas
          ref={canvasRef}
          width={CW * SCALE}
          height={CH * SCALE}
          className="absolute inset-0 h-full w-full"
          style={{ imageRendering: "pixelated" }}
          aria-hidden
        />

        {/* keyboard-only focus targets (mouse/touch use precise canvas hit-testing);
            pointer-events none so they never block the pointer hover above */}
        <svg
          viewBox={`0 0 ${CW} ${CH}`}
          className="pointer-events-none absolute inset-0 h-full w-full"
          preserveAspectRatio="none"
          role="img"
          aria-label="The Bitcoin transaction lifecycle: transactions gather in the mempool, nodes validate them, a miner hashes a block, and it links onto the chain. Hover any part with the pointer, or Tab through the regions, to inspect it."
        >
          <g role="group" aria-label="Inspect the machine">
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
                  style={{ outline: "none" }}
                  onFocus={() => setHovered({ kind: r })}
                  onBlur={() => setHovered(null)}
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
                <span style={{ color: MAGENTA }}>✓ magenta miner found a valid hash</span>
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
            <div className="mt-1 text-xs text-muted">
              {info.term}
              {hovered?.kind === "tx" && hovered.fee != null && <span className="text-fg"> · ~{Math.round(hovered.fee)} sat/vB fee</span>}
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-muted">{info.body}</p>
          </div>
        ) : (
          <div className="text-xs text-muted">
            {`// inspect`} · hover any part — a transaction, a hash, a worker, a node, the chain{" "}
            <span className="text-accent blink">█</span>
          </div>
        )}
      </div>
    </div>
  );
}

function zone(r: Region): { x: number; y: number; w: number; h: number } {
  const SPLIT = NODE_Y1 + 6; // divide the right column: nodes above, mempool below
  switch (r) {
    // top-right strip the node robots roam
    case "nodes":
      return { x: MEM_X0 - 28, y: 0, w: CW - (MEM_X0 - 28), h: SPLIT };
    // the whole transaction pool below the nodes
    case "mempool":
      return { x: MEM_X0 - 8, y: SPLIT, w: CW - (MEM_X0 - 8), h: CH - SPLIT };
    // the pickaxes to the left of the two racing blocks
    case "miner":
      return { x: ABX - 20, y: TOPB - 4, w: 22, h: BOTB + BLOCK - TOPB + 8 };
    // the two racing blocks (and the centre-stage block) + their headers
    case "block":
      return { x: ABX - 5, y: TOPB - 8, w: BLOCK + 8, h: BOTB + BLOCK - TOPB + 16 };
    // the sealed chain along the middle row, including the tip and the block bleeding off-screen
    case "chain":
      return { x: 0, y: MID - 8, w: CHAIN_RIGHT + 22, h: BLOCK + 16 };
    // the prev-hash link between the two rightmost chain blocks
    case "link":
      return { x: CHAIN_RIGHT - 16, y: MID + 2, w: 20, h: 22 };
  }
}
