"use client";

import { useEffect, useState } from "react";
import { feeToColor } from "@/lib/fee";
import { sha256 } from "@/lib/sha256";
import { digitColor, H01, H23, HASH_OF, LEAF, PREV, ROOT } from "@/lib/merkle";

/* =====================================================================
   A Merkle tree, zoomed in and honest, in our flat / barcode language.

   Every hash is drawn as its REAL 64 hex characters — one thin stripe per
   character. A '0' digit is a white stripe, so a mined block hash shows a
   run of white bars at the front (its leading zeros / proof-of-work).

   Two views of the same block:
     ① fold — transactions are hashed, then hashes are concatenated in
       pairs and hashed again, level by level, up to one Merkle root.
     ② mine — the tree is sealed; we take prev-hash + root + nonce, hash
       the header into the block hash, and grind the nonce until that
       hash starts with enough white-stripe zeros.
   ===================================================================== */

const TARGET = "0000"; // mined block hash must start with this many hex zeros

const C = {
  fg: "var(--fg)",
  muted: "var(--muted)",
  faint: "var(--faint)",
  accent: "var(--accent)",
  border: "var(--border)",
  bg: "var(--bg)",
};

// stripe rects for the big tree SVG (viewBox units)
function stripes(x: number, y: number, w: number, h: number, hex: string, grey = false) {
  const n = hex.length;
  const pitch = w / n;
  const fw = Math.max(0.34, pitch * 0.72);
  return (
    <g>
      {[...hex].map((ch, i) => (
        <rect key={i} x={x + i * pitch} y={y} width={fw} height={h} fill={digitColor(ch, grey)} />
      ))}
    </g>
  );
}

/** A hash barcode for inline HTML use (stretches to its CSS width). */
function MiniBar({
  hex,
  grey = false,
  className = "",
}: {
  hex: string;
  grey?: boolean;
  className?: string;
}) {
  return (
    <svg
      viewBox={`0 0 ${hex.length} 10`}
      preserveAspectRatio="none"
      className={`inline-block h-4 w-20 shrink-0 border border-border ${className}`}
    >
      {[...hex].map((ch, i) => (
        <rect key={i} x={i + 0.14} y={0} width={0.72} height={10} fill={digitColor(ch, grey)} />
      ))}
    </svg>
  );
}

type NodeId = "root" | "h01" | "h23" | "h0" | "h1" | "h2" | "h3" | "t0" | "t1" | "t2" | "t3";

const P: Record<NodeId, { cx: number; cy: number; hw: number; hh: number }> = {
  root: { cx: 340, cy: 143, hw: 92, hh: 10 }, // merkle root, inside the header
  h01: { cx: 200, cy: 238, hw: 62, hh: 15 },
  h23: { cx: 480, cy: 238, hw: 62, hh: 15 },
  h0: { cx: 120, cy: 328, hw: 58, hh: 15 },
  h1: { cx: 280, cy: 328, hw: 58, hh: 15 },
  h2: { cx: 400, cy: 328, hw: 58, hh: 15 },
  h3: { cx: 560, cy: 328, hw: 58, hh: 15 },
  t0: { cx: 120, cy: 422, hw: 40, hh: 18 },
  t1: { cx: 280, cy: 422, hw: 40, hh: 18 },
  t2: { cx: 400, cy: 422, hw: 40, hh: 18 },
  t3: { cx: 560, cy: 422, hw: 40, hh: 18 },
};

const TX = [
  { id: "t0" as NodeId, label: "Tx0", fee: 3 },
  { id: "t1" as NodeId, label: "Tx1", fee: 14 },
  { id: "t2" as NodeId, label: "Tx2", fee: 46 },
  { id: "t3" as NodeId, label: "Tx3", fee: 8 },
];
const HASHN = [
  { id: "h01" as NodeId, label: "Hash01" },
  { id: "h23" as NodeId, label: "Hash23" },
  { id: "h0" as NodeId, label: "Hash0" },
  { id: "h1" as NodeId, label: "Hash1" },
  { id: "h2" as NodeId, label: "Hash2" },
  { id: "h3" as NodeId, label: "Hash3" },
];
// child → parent, tagged with the fold level that computes the parent
const EDGES: [NodeId, NodeId, number][] = [
  ["t0", "h0", 0],
  ["t1", "h1", 0],
  ["t2", "h2", 0],
  ["t3", "h3", 0],
  ["h0", "h01", 1],
  ["h1", "h01", 1],
  ["h2", "h23", 1],
  ["h3", "h23", 1],
  ["h01", "root", 2],
  ["h23", "root", 2],
];

// block-hash bar geometry + its feeder fields
const BH = { x: 116, y: 40, w: 528, h: 22 };
const PREVF = { cx: 150, cy: 116, hw: 82, hh: 8 };
const NONCEF = { cx: 532, cy: 116, hw: 62, hh: 8 };

export default function MerkleTree() {
  const [step, setStep] = useState<"fold" | "mine">("fold");
  const [level, setLevel] = useState(0); // fold wave 0 leaves → 1 pairs → 2 root → 3 done
  const [reduced, setReduced] = useState(false);
  const [run, setRun] = useState(0); // remine counter
  const [mine, setMine] = useState<{ hex: string; nonce: number; tries: number; done: boolean }>({
    hex: sha256(PREV + ROOT + "0"),
    nonce: 0,
    tries: 0,
    done: false,
  });

  useEffect(() => {
    const m = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setReduced(m.matches);
    on();
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);

  // fold wave (only while folding)
  useEffect(() => {
    if (reduced || step !== "fold") return;
    const id = setInterval(() => setLevel((l) => (l + 1) % 4), 1250);
    return () => clearInterval(id);
  }, [reduced, step]);
  const effLevel = reduced ? 3 : level;

  // the mining grind — real SHA-256, nonce++ until TARGET leading zeros
  useEffect(() => {
    if (step !== "mine") return;
    const start = run * 250000; // each run searches a fresh stretch → a different valid nonce
    if (reduced) {
      let n = start;
      let h = "";
      for (let i = 0; i < 3_000_000; i++) {
        h = sha256(PREV + ROOT + n);
        if (h.startsWith(TARGET)) break;
        n++;
      }
      const t = window.setTimeout(() => setMine({ hex: h, nonce: n, tries: n - start + 1, done: true }), 0);
      return () => window.clearTimeout(t);
    }
    let nonce = start;
    let tries = 0;
    let done = false;
    let raf = 0;
    const tick = () => {
      let hLast = "";
      for (let k = 0; k < 1400 && !done; k++) {
        hLast = sha256(PREV + ROOT + nonce);
        tries++;
        if (hLast.startsWith(TARGET)) {
          done = true;
          break;
        }
        nonce++;
      }
      setMine({ hex: hLast, nonce, tries, done });
      if (!done) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [step, reduced, run]);

  const folding = step === "fold";
  const nodeHot = (id: NodeId): boolean => {
    if (!folding) return false;
    if (effLevel === 0) return id === "h0" || id === "h1" || id === "h2" || id === "h3";
    if (effLevel === 1) return id === "h01" || id === "h23";
    return id === "root";
  };
  const rootReady = !folding || effLevel >= 2;
  const treeOp = folding ? 1 : 0.28; // tree + transactions fade back while mining

  // ---- edges ----
  const edgeEls = EDGES.map(([from, to, lvl]) => {
    const a = P[from];
    const b = P[to];
    const x2 = to === "root" ? b.cx + (from === "h01" ? -22 : 22) : b.cx;
    const hot = folding && lvl === effLevel && effLevel < 3;
    return (
      <line
        key={`${from}>${to}`}
        x1={a.cx}
        y1={a.cy - a.hh}
        x2={x2}
        y2={b.cy + b.hh}
        stroke={hot ? C.accent : C.faint}
        strokeWidth={hot ? 2 : 1.1}
        markerEnd={hot ? "url(#mkHot)" : "url(#mkDim)"}
        opacity={folding ? 1 : 0.3}
        style={{ transition: "stroke 0.3s, opacity 0.3s, stroke-width 0.3s" }}
      />
    );
  });

  // header fields → block-hash bar (shown while mining)
  const feeder = (fx: number, fy: number, tx: number) => (
    <line
      x1={fx}
      y1={fy}
      x2={tx}
      y2={BH.y + BH.h}
      stroke={folding ? C.border : C.accent}
      strokeWidth={folding ? 1 : 2}
      markerEnd={folding ? "url(#mkDim)" : "url(#mkHot)"}
      opacity={folding ? 0.25 : 1}
      style={{ transition: "stroke 0.3s, opacity 0.3s, stroke-width 0.3s" }}
    />
  );

  return (
    <div className="flex h-full flex-col gap-4">
      {/* step switch */}
      <div className="flex items-center gap-3">
        <div className="inline-flex border border-border font-mono text-xs">
          {(["fold", "mine"] as const).map((s, i) => (
            <button
              key={s}
              type="button"
              onClick={() => setStep(s)}
              className={`px-3 py-1.5 transition ${i === 0 ? "border-r border-border" : ""} ${
                step === s ? "bg-accent text-bg" : "text-muted hover:text-fg"
              }`}
            >
              {i === 0 ? "① fold" : "② mine"}
            </button>
          ))}
        </div>
        <span className="font-mono text-xs text-faint">
          {folding
            ? "concatenate & hash, level by level → one Merkle root"
            : "hash the header, grind the nonce → a block hash with leading zeros"}
        </span>
      </div>

      <div className="border border-border bg-panel p-3 sm:p-4">
        <svg
          viewBox="0 0 680 470"
          className="h-auto w-full"
          style={{ fontFamily: "var(--font-mono)" }}
          role="img"
          aria-label="A Merkle tree with full-length SHA-256 hashes; four transactions fold into one Merkle root, then the block header is hashed and mined."
        >
          <defs>
            <marker id="mkDim" markerWidth="8" markerHeight="8" refX="5.6" refY="3" orient="auto">
              <path d="M0,0 L6,3 L0,6 Z" fill={C.faint} />
            </marker>
            <marker id="mkHot" markerWidth="8" markerHeight="8" refX="5.6" refY="3" orient="auto">
              <path d="M0,0 L6,3 L0,6 Z" fill={C.accent} />
            </marker>
          </defs>

          {/* outer block */}
          <rect x={8} y={8} width={664} height={454} fill="none" stroke={C.border} />
          <text x={20} y={26} fontSize="11" fill={C.muted}>
            Block
          </text>

          {/* ---- block hash bar (top) ---- */}
          <text x={BH.x} y={34} fontSize="10.5" fill={mine.done && !folding ? C.accent : C.muted}>
            Block Hash
            <tspan fill={C.faint}>{"  · SHA-256(header)"}</tspan>
          </text>
          {folding ? (
            <>
              <rect x={BH.x} y={BH.y} width={BH.w} height={BH.h} fill="none" stroke={C.border} />
              <text x={BH.x + BH.w / 2} y={BH.y + BH.h / 2 + 3.5} textAnchor="middle" fontSize="9" fill={C.faint}>
                sealed after mining — switch to ② mine
              </text>
            </>
          ) : (
            <>
              <rect
                x={BH.x}
                y={BH.y}
                width={BH.w}
                height={BH.h}
                fill={C.bg}
                stroke={mine.done ? C.accent : C.border}
                strokeWidth={mine.done ? 2 : 1}
              />
              {stripes(BH.x + 3, BH.y + 3, BH.w - 6, BH.h - 6, mine.hex)}
              {mine.done && (
                <>
                  <line
                    x1={BH.x + 3}
                    y1={BH.y + BH.h + 4}
                    x2={BH.x + 3 + TARGET.length * ((BH.w - 6) / mine.hex.length)}
                    y2={BH.y + BH.h + 4}
                    stroke={C.accent}
                    strokeWidth={2}
                  />
                  <text x={BH.x + 3} y={BH.y + BH.h + 15} fontSize="8.5" fill={C.accent}>
                    {TARGET.length} leading zeros = the work
                  </text>
                </>
              )}
            </>
          )}

          {/* ---- block header ---- */}
          <rect x={44} y={74} width={592} height={92} fill="none" stroke={C.border} />
          <text x={340} y={90} textAnchor="middle" fontSize="10" fill={C.faint}>
            Block Header
          </text>

          {/* prev hash (grey) */}
          <text x={PREVF.cx} y={106} textAnchor="middle" fontSize="9.5" fill={C.muted}>
            Prev Hash
          </text>
          <rect
            x={PREVF.cx - PREVF.hw}
            y={PREVF.cy - PREVF.hh}
            width={PREVF.hw * 2}
            height={PREVF.hh * 2}
            fill={C.bg}
            stroke={C.border}
          />
          {stripes(PREVF.cx - PREVF.hw + 2, PREVF.cy - PREVF.hh + 2, PREVF.hw * 2 - 4, PREVF.hh * 2 - 4, PREV, true)}

          {/* nonce (a number the miner turns) */}
          <text x={NONCEF.cx} y={106} textAnchor="middle" fontSize="9.5" fill={folding ? C.muted : C.accent}>
            Nonce
          </text>
          <rect
            x={NONCEF.cx - NONCEF.hw}
            y={NONCEF.cy - NONCEF.hh}
            width={NONCEF.hw * 2}
            height={NONCEF.hh * 2}
            fill={C.bg}
            stroke={folding ? C.border : C.accent}
            style={{ transition: "stroke 0.3s" }}
          />
          <text
            x={NONCEF.cx}
            y={NONCEF.cy + 3.5}
            textAnchor="middle"
            fontSize="10"
            fill={folding ? C.faint : C.fg}
            fontWeight="600"
          >
            {folding ? "nonce ?" : mine.nonce.toLocaleString()}
          </text>

          {/* merkle root (target of the tree, input to the block hash) */}
          <text
            x={P.root.cx}
            y={P.root.cy - P.root.hh - 5}
            textAnchor="middle"
            fontSize="10"
            fill={rootReady ? C.accent : C.muted}
            style={{ transition: "fill 0.3s" }}
          >
            Merkle Root
          </text>
          <rect
            x={P.root.cx - P.root.hw}
            y={P.root.cy - P.root.hh}
            width={P.root.hw * 2}
            height={P.root.hh * 2}
            fill={C.bg}
            stroke={rootReady ? C.accent : C.border}
            strokeWidth={rootReady ? 2 : 1}
            style={{ transition: "stroke 0.3s, stroke-width 0.3s" }}
          />
          {stripes(P.root.cx - P.root.hw + 4, P.root.cy - P.root.hh + 3, P.root.hw * 2 - 8, P.root.hh * 2 - 6, ROOT)}

          {/* header → block-hash feeders */}
          {feeder(PREVF.cx, PREVF.cy - PREVF.hh, BH.x + BH.w * 0.34)}
          {feeder(P.root.cx, P.root.cy - P.root.hh, BH.x + BH.w * 0.5)}
          {feeder(NONCEF.cx, NONCEF.cy - NONCEF.hh, BH.x + BH.w * 0.66)}

          {/* ---- tree (edges, hashes, transactions) ---- */}
          <g opacity={treeOp} style={{ transition: "opacity 0.3s" }}>
            {edgeEls}
            {HASHN.map((h) => {
              const p = P[h.id];
              const hot = nodeHot(h.id);
              return (
                <g key={h.id}>
                  <text
                    x={p.cx}
                    y={p.cy - p.hh - 5}
                    textAnchor="middle"
                    fontSize="10"
                    fill={hot ? C.accent : C.muted}
                    style={{ transition: "fill 0.3s" }}
                  >
                    {h.label}
                  </text>
                  <rect
                    x={p.cx - p.hw}
                    y={p.cy - p.hh}
                    width={p.hw * 2}
                    height={p.hh * 2}
                    fill={C.bg}
                    stroke={hot ? C.accent : C.border}
                    strokeWidth={hot ? 2 : 1}
                    style={{ transition: "stroke 0.3s, stroke-width 0.3s" }}
                  />
                  {stripes(p.cx - p.hw + 4, p.cy - 6, p.hw * 2 - 8, 12, HASH_OF[h.id])}
                </g>
              );
            })}
            {TX.map((t) => {
              const p = P[t.id];
              const col = feeToColor(t.fee);
              return (
                <g key={t.id}>
                  <rect
                    x={p.cx - p.hw}
                    y={p.cy - p.hh}
                    width={p.hw * 2}
                    height={p.hh * 2}
                    fill={col}
                    fillOpacity={0.22}
                    stroke={col}
                    strokeWidth={1.2}
                  />
                  <text x={p.cx} y={p.cy + 3.5} textAnchor="middle" fontSize="12" fill={C.fg} fontWeight="600">
                    {t.label}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>
      </div>

      {/* ---- step-specific readout ---- */}
      {folding ? (
        <FoldReadout level={effLevel} />
      ) : (
        <MineReadout mine={mine} onRemine={() => setRun((r) => r + 1)} />
      )}
    </div>
  );
}

// how a parent hash is actually built — follows the fold wave
function FoldReadout({ level }: { level: number }) {
  const rows: { note: string; a?: string; aGrey?: boolean; aChip?: string; b?: string; out: string }[] = [
    { note: "leaf hash = SHA-256( the transaction's bytes )", aChip: "Tx0", out: LEAF[0] },
    { note: "Hash01 = SHA-256( Hash0 ‖ Hash1 ) — the two hashes' bytes joined, then hashed", a: LEAF[0], b: LEAF[1], out: H01 },
    { note: "Merkle Root = SHA-256( Hash01 ‖ Hash23 )", a: H01, b: H23, out: ROOT },
    { note: "one 32-byte root now stands in for all four transactions", a: ROOT, out: ROOT },
  ];
  const r = rows[level];
  return (
    <div className="border border-border bg-panel/50 p-3">
      <div className="mb-2 flex items-center gap-1.5 font-mono text-xs text-accent">concatenate → hash</div>
      <div className="flex flex-wrap items-center gap-2 font-mono text-[0.7rem] text-muted">
        {r.aChip ? (
          <span className="border border-border px-2 py-1 text-fg">{r.aChip}</span>
        ) : (
          <MiniBar hex={r.a!} />
        )}
        {r.b && (
          <>
            <span className="text-faint">‖</span>
            <MiniBar hex={r.b} />
          </>
        )}
        {level < 3 && <span className="text-accent">→ SHA-256 →</span>}
        {level < 3 && <MiniBar hex={r.out} />}
      </div>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        <span className="text-accent">{"» "}</span>
        {r.note}. A hash is just its bytes; combining two of them is nothing more than
        writing one after the other and hashing the result.
      </p>
    </div>
  );
}

function MineReadout({
  mine,
  onRemine,
}: {
  mine: { hex: string; nonce: number; tries: number; done: boolean };
  onRemine: () => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
      <div className="border border-border bg-panel/50 p-3">
        <div className="mb-1 font-mono text-xs text-accent">
          {mine.done ? "found a valid block hash ✓" : "grinding the nonce…"}
        </div>
        <p className="text-sm leading-relaxed text-muted">
          The header (<span className="text-fg">prev hash</span> +{" "}
          <span className="text-accent">merkle root</span> + nonce) is hashed into the block
          hash. Only the nonce changes; each try scrambles the whole hash. A block counts as
          valid once it starts with{" "}
          <span className="text-fg">{TARGET.length} zeros</span> — the white stripes.
        </p>
        <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 font-mono text-xs text-faint">
          <span>
            nonce <span className="text-fg">{mine.nonce.toLocaleString()}</span>
          </span>
          <span>
            hashes tried <span className="text-fg">{mine.tries.toLocaleString()}</span>
          </span>
          <span>
            target <span className="text-fg">{TARGET.length} leading zeros</span>
          </span>
        </div>
      </div>
      <button
        type="button"
        onClick={onRemine}
        className="self-start border border-border px-3.5 py-2 font-mono text-sm text-muted transition hover:border-fg hover:text-fg"
      >
        [ mine again ]
      </button>
    </div>
  );
}
