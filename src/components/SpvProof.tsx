"use client";

import { useEffect, useRef, useState } from "react";
import { feeToColor } from "@/lib/fee";
import { digitColor, H01, H23, LEAF, ROOT } from "@/lib/merkle";

/* =====================================================================
   Simplified Payment Verification.

   A light client wants to prove ONE payment (Tx3) is in a block, without
   downloading the block. It already trusts the block header (and its
   Merkle root). It hashes its own copy of Tx3, asks any full node for the
   two sibling hashes on the path — the "branch" — recomputes the root, and
   checks it matches the header. Everything off the path is never needed.
   Real SHA-256; the recomputed root equals the Merkle page's root.
   ===================================================================== */

const C = {
  fg: "var(--fg)",
  muted: "var(--muted)",
  faint: "var(--faint)",
  accent: "var(--accent)",
  green: "var(--green)",
  border: "var(--border)",
  bg: "var(--bg)",
};

function stripes(x: number, y: number, w: number, h: number, hex: string, grey = false) {
  const pitch = w / hex.length;
  const fw = Math.max(0.34, pitch * 0.72);
  return (
    <g>
      {[...hex].map((ch, i) => (
        <rect key={i} x={x + i * pitch} y={y} width={fw} height={h} fill={digitColor(ch, grey)} />
      ))}
    </g>
  );
}

function MiniBar({ hex, className = "" }: { hex: string; className?: string }) {
  return (
    <svg
      viewBox={`0 0 ${hex.length} 10`}
      preserveAspectRatio="none"
      className={`inline-block h-4 w-20 shrink-0 border border-border ${className}`}
    >
      {[...hex].map((ch, i) => (
        <rect key={i} x={i + 0.14} y={0} width={0.72} height={10} fill={digitColor(ch)} />
      ))}
    </svg>
  );
}

type Id = "root" | "h01" | "h23" | "h0" | "h1" | "h2" | "h3" | "t0" | "t1" | "t2" | "t3";

const N: Record<Id, { cx: number; cy: number; hw: number; hh: number }> = {
  root: { cx: 340, cy: 74, hw: 116, hh: 11 },
  h01: { cx: 200, cy: 172, hw: 60, hh: 14 },
  h23: { cx: 480, cy: 172, hw: 60, hh: 14 },
  h0: { cx: 120, cy: 260, hw: 54, hh: 13 },
  h1: { cx: 280, cy: 260, hw: 54, hh: 13 },
  h2: { cx: 400, cy: 260, hw: 54, hh: 13 },
  h3: { cx: 560, cy: 260, hw: 54, hh: 13 },
  t0: { cx: 120, cy: 350, hw: 38, hh: 17 },
  t1: { cx: 280, cy: 350, hw: 38, hh: 17 },
  t2: { cx: 400, cy: 350, hw: 38, hh: 17 },
  t3: { cx: 560, cy: 350, hw: 38, hh: 17 },
};

// step at which each node on the proof path becomes known
const REVEAL: Partial<Record<Id, number>> = { t3: 0, h3: 1, h2: 2, h23: 3, h01: 4 };
const SIBLINGS = new Set<Id>(["h2", "h01"]); // handed over by a node — slide in
const OFFPATH: Id[] = ["t0", "t1", "t2", "h0", "h1"];

const EDGES: [Id, Id, boolean, number][] = [
  // child, parent, onProofPath, step-it-activates
  ["t3", "h3", true, 1],
  ["h3", "h23", true, 3],
  ["h2", "h23", true, 3],
  ["h23", "root", true, 5],
  ["h01", "root", true, 5],
  ["t0", "h0", false, 99],
  ["t1", "h1", false, 99],
  ["t2", "h2", false, 99],
  ["h0", "h01", false, 99],
  ["h1", "h01", false, 99],
];

const STEPS = 6;
const CAPTIONS = [
  "You want to check one payment — Tx3 — against a block whose header you already trust.",
  "Hash your own copy of the payment:  Hash3 = SHA-256( Tx3 ).",
  "Ask any full node for the branch — it hands you Hash2.",
  "Combine them:  Hash23 = SHA-256( Hash2 ‖ Hash3 ).",
  "It also hands you Hash01 — the other sibling on the path.",
  "Root = SHA-256( Hash01 ‖ Hash23 ). It matches the header's Merkle root ✓ — Tx3 is in the block.",
];

const HEX: Record<Id, string> = {
  root: ROOT,
  h01: H01,
  h23: H23,
  h0: LEAF[0],
  h1: LEAF[1],
  h2: LEAF[2],
  h3: LEAF[3],
  t0: "",
  t1: "",
  t2: "",
  t3: "",
};

export default function SpvProof() {
  const [step, setStep] = useState(0);
  const [reduced, setReduced] = useState(false);
  const stepRef = useRef(0);

  useEffect(() => {
    const m = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setReduced(m.matches);
    on();
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);

  useEffect(() => {
    stepRef.current = step;
  }, [step]);

  // self-scheduling clock — the "verified" conclusion (step 5) dwells longer
  useEffect(() => {
    if (reduced) return; // effStep pins to the finished, matched state
    const dwell = (s: number) => (s === 5 ? 3000 : 1500);
    let id: ReturnType<typeof setTimeout>;
    const tick = () => {
      const next = (stepRef.current + 1) % STEPS;
      setStep(next);
      id = setTimeout(tick, dwell(next));
    };
    id = setTimeout(tick, dwell(stepRef.current));
    return () => clearTimeout(id);
  }, [reduced]);

  const effStep = reduced ? 5 : step;
  const matched = effStep >= 5;
  const known = (id: Id) => REVEAL[id] !== undefined && effStep >= (REVEAL[id] as number);
  const offOpacity = Math.max(0.05, 0.42 - effStep * 0.09);

  const edgeEls = EDGES.map(([from, to, proof, at]) => {
    const a = N[from];
    const b = N[to];
    const x2 = to === "root" ? b.cx + (from === "h01" ? -24 : 24) : b.cx;
    const active = proof && effStep >= at;
    return (
      <line
        key={`${from}>${to}`}
        x1={a.cx}
        y1={a.cy - a.hh}
        x2={x2}
        y2={b.cy + b.hh}
        stroke={active ? C.accent : C.faint}
        strokeWidth={active ? 2 : 1}
        markerEnd={active ? "url(#spvHot)" : "url(#spvDim)"}
        opacity={proof ? 1 : offOpacity}
        style={{ transition: "stroke 0.4s, stroke-width 0.4s, opacity 0.5s" }}
      />
    );
  });

  const hashNode = (id: Id, label: string) => {
    const p = N[id];
    const isRoot = id === "root";
    const on = isRoot ? true : known(id);
    const sib = SIBLINGS.has(id);
    const stroke = isRoot ? (matched ? C.green : C.accent) : on ? C.accent : C.border;
    const off = OFFPATH.includes(id);
    return (
      <g
        key={id}
        opacity={off ? offOpacity : on ? 1 : 0.25}
        style={{
          transition: "opacity 0.5s, transform 0.5s",
          transform: sib && !on ? "translateX(30px)" : "translateX(0)",
        }}
      >
        <text
          x={p.cx}
          y={p.cy - p.hh - 5}
          textAnchor="middle"
          fontSize="10"
          fill={isRoot ? (matched ? C.green : C.accent) : on ? C.accent : C.muted}
          style={{ transition: "fill 0.4s" }}
        >
          {label}
        </text>
        <rect
          x={p.cx - p.hw}
          y={p.cy - p.hh}
          width={p.hw * 2}
          height={p.hh * 2}
          fill={C.bg}
          stroke={stroke}
          strokeWidth={on && !off ? 2 : 1}
          style={{ transition: "stroke 0.4s, stroke-width 0.4s" }}
        />
        {stripes(p.cx - p.hw + 4, p.cy - (p.hh - 3), p.hw * 2 - 8, p.hh * 2 - 6, HEX[id])}
        {sib && on && (
          <text x={p.cx} y={p.cy + p.hh + 12} textAnchor="middle" fontSize="8.5" fill={C.accent}>
            ◂ from a node
          </text>
        )}
      </g>
    );
  };

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="border border-border bg-panel p-3 sm:p-4">
        <svg
          viewBox="0 0 680 398"
          className="h-auto w-full"
          style={{ fontFamily: "var(--font-mono)" }}
          role="img"
          aria-label="Simplified payment verification: Tx3 is proven to be in the block using only two sibling hashes and the header's Merkle root."
        >
          <defs>
            <marker id="spvDim" markerWidth="8" markerHeight="8" refX="5.6" refY="3" orient="auto">
              <path d="M0,0 L6,3 L0,6 Z" fill={C.faint} />
            </marker>
            <marker id="spvHot" markerWidth="8" markerHeight="8" refX="5.6" refY="3" orient="auto">
              <path d="M0,0 L6,3 L0,6 Z" fill={C.accent} />
            </marker>
          </defs>

          {/* header / trusted anchor */}
          <text x={N.root.cx} y={30} textAnchor="middle" fontSize="10.5" fill={C.faint}>
            Block Header — you already have this (80 bytes)
          </text>
          {hashNode("root", matched ? "Merkle Root ✓ matches" : "Merkle Root")}

          {edgeEls}

          {hashNode("h01", "Hash01")}
          {hashNode("h23", "Hash23")}
          {hashNode("h0", "Hash0")}
          {hashNode("h1", "Hash1")}
          {hashNode("h2", "Hash2")}
          {hashNode("h3", "Hash3")}

          {(["t0", "t1", "t2", "t3"] as Id[]).map((id) => {
            const p = N[id];
            const idx = Number(id[1]);
            const isTarget = id === "t3";
            const col = feeToColor([3, 14, 46, 8][idx]);
            const on = isTarget; // only the payment you care about is "yours"
            return (
              <g
                key={id}
                opacity={isTarget ? 1 : offOpacity}
                style={{ transition: "opacity 0.5s" }}
              >
                <rect
                  x={p.cx - p.hw}
                  y={p.cy - p.hh}
                  width={p.hw * 2}
                  height={p.hh * 2}
                  fill={col}
                  fillOpacity={on ? 0.28 : 0.18}
                  stroke={on ? C.accent : col}
                  strokeWidth={on ? 2 : 1.1}
                  style={{ transition: "stroke 0.4s, stroke-width 0.4s" }}
                />
                <text x={p.cx} y={p.cy + 3.5} textAnchor="middle" fontSize="12" fill={C.fg} fontWeight="600">
                  {`Tx${idx}`}
                </text>
                {isTarget && (
                  <text x={p.cx} y={p.cy + p.hh + 12} textAnchor="middle" fontSize="8.5" fill={C.accent}>
                    your payment
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* live caption */}
      <div className="flex min-h-[2.5rem] items-center gap-2 border border-border bg-panel/50 px-3 py-2 font-mono text-sm">
        <span className={matched ? "text-green" : "text-accent"}>
          {matched ? "✓" : `${effStep + 1}/${STEPS}`}
        </span>
        <span className="text-muted">{CAPTIONS[effStep]}</span>
      </div>

      {/* what you needed vs what you skipped */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="border border-border bg-panel/50 p-3">
          <div className="mb-1.5 font-mono text-xs text-accent">downloaded — 4 things</div>
          <div className="flex flex-col gap-1.5 font-mono text-[0.72rem] text-muted">
            <span className="text-fg">block header (Merkle root)</span>
            <span>
              Tx3 <span className="text-faint">· your own payment</span>
            </span>
            <span className="flex items-center gap-1.5">
              Hash2 <MiniBar hex={LEAF[2]} />
            </span>
            <span className="flex items-center gap-1.5">
              Hash01 <MiniBar hex={H01} />
            </span>
          </div>
        </div>
        <div className="border border-border bg-panel/50 p-3">
          <div className="mb-1.5 font-mono text-xs text-faint">never downloaded</div>
          <p className="text-sm leading-relaxed text-muted">
            Tx0, Tx1, Tx2 and their hashes stay unknown to you — yet the recomputed root
            still matches, so Tx3 <span className="text-fg">must</span> be in the block. For a
            block of 1,024 transactions the branch is just{" "}
            <span className="text-accent">10 hashes</span>, not a thousand. That is how a phone
            wallet verifies payments it can&apos;t store.
          </p>
        </div>
      </div>
    </div>
  );
}
