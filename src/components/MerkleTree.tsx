"use client";

import { useEffect, useMemo, useState } from "react";
import { Btn } from "@/components/ui";
import { feeToColor } from "@/lib/fee";

/* =====================================================================
   A Merkle tree, in our flat / barcode design language.

   Transactions (boxes) are hashed into leaf hashes (colour barcodes),
   which are hashed in pairs, level by level, until a single Merkle root
   sits in the block header. A "fold" wave rises up the tree to show the
   pairing; the prune toggle drops Tx0–Tx2 to show how little you must
   keep to still prove Tx3 is in the block. Recreates the Bitcoin
   whitepaper schematic. Crisp SVG, square, no radius, no glow.
   ===================================================================== */

/* deterministic PRNG so the barcodes are identical on server + client
   (no hydration mismatch) and stable across re-renders. */
function makeRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* a hash drawn as many thin bars — colourful for a plain hash, grey for
   the previous-block reference, white bars standing in for leading zeros. */
function bars(seed: number, n: number, grey = false, zeros = 0): string[] {
  const r = makeRng(seed);
  return Array.from({ length: n }, (_, i) => {
    const a = r();
    const b = r();
    const c = r();
    if (i < zeros) return "#ffffff";
    return grey
      ? `hsl(0, 0%, ${Math.round(30 + a * 40)}%)`
      : `hsl(${Math.round(a * 360)}, ${Math.round(55 + b * 25)}%, ${Math.round(46 + c * 20)}%)`;
  });
}

/* a short, real-looking hex string for a node — "the actual hash". */
function hex(seed: number, len = 8): string {
  const r = makeRng(seed ^ 0x9e3779b9);
  const ch = "0123456789abcdef";
  let out = "";
  for (let i = 0; i < len; i++) out += ch[Math.floor(r() * 16)];
  return out;
}

type NodeId =
  | "root"
  | "h01"
  | "h23"
  | "h0"
  | "h1"
  | "h2"
  | "h3"
  | "t0"
  | "t1"
  | "t2"
  | "t3";

// centre + half-extents of every node's box, in viewBox units
const P: Record<NodeId, { cx: number; cy: number; hw: number; hh: number }> = {
  root: { cx: 340, cy: 131, hw: 82, hh: 15 },
  h01: { cx: 200, cy: 212, hw: 54, hh: 16 },
  h23: { cx: 480, cy: 212, hw: 54, hh: 16 },
  h0: { cx: 120, cy: 302, hw: 50, hh: 16 },
  h1: { cx: 280, cy: 302, hw: 50, hh: 16 },
  h2: { cx: 400, cy: 302, hw: 50, hh: 16 },
  h3: { cx: 560, cy: 302, hw: 50, hh: 16 },
  t0: { cx: 120, cy: 398, hw: 36, hh: 19 },
  t1: { cx: 280, cy: 398, hw: 36, hh: 19 },
  t2: { cx: 400, cy: 398, hw: 36, hh: 19 },
  t3: { cx: 560, cy: 398, hw: 36, hh: 19 },
};

const HASH_NODES: { id: NodeId; label: string; seed: number; n: number }[] = [
  { id: "h01", label: "Hash01", seed: 8101, n: 13 },
  { id: "h23", label: "Hash23", seed: 8123, n: 13 },
  { id: "h0", label: "Hash0", seed: 8010, n: 12 },
  { id: "h1", label: "Hash1", seed: 8011, n: 12 },
  { id: "h2", label: "Hash2", seed: 8012, n: 12 },
  { id: "h3", label: "Hash3", seed: 8013, n: 12 },
];

const TX_NODES: { id: NodeId; label: string; seed: number; fee: number }[] = [
  { id: "t0", label: "Tx0", seed: 200, fee: 3 },
  { id: "t1", label: "Tx1", seed: 201, fee: 14 },
  { id: "t2", label: "Tx2", seed: 202, fee: 46 },
  { id: "t3", label: "Tx3", seed: 203, fee: 8 },
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

// pruning Tx0–Tx2: these get dropped …
const DROPPED = new Set<NodeId>(["t0", "t1", "t2", "h0", "h1"]);
// … and this branch + its sibling hashes is all you keep to still prove Tx3
const PROOF_NODES = new Set<NodeId>(["t3", "h3", "h2", "h23", "h01", "root"]);
const PROOF_EDGES = new Set<string>([
  "t3>h3",
  "h3>h23",
  "h2>h23",
  "h23>root",
  "h01>root",
]);

const C = {
  fg: "var(--fg)",
  muted: "var(--muted)",
  faint: "var(--faint)",
  accent: "var(--accent)",
  border: "var(--border)",
  panel: "var(--panel)",
  bg: "var(--bg)",
};

export default function MerkleTree() {
  const [level, setLevel] = useState(0); // fold wave: 0 leaves → 1 pairs → 2 root → 3 done
  const [pruned, setPruned] = useState(false);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const m = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setReduced(m.matches);
    on();
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);

  useEffect(() => {
    if (reduced || pruned) return; // hold; effLevel below pins it to "done"
    const id = setInterval(() => setLevel((l) => (l + 1) % 4), 1150);
    return () => clearInterval(id);
  }, [reduced, pruned]);

  // when we're not cycling (reduced motion, or pruned), show the finished tree
  const effLevel = reduced || pruned ? 3 : level;

  // barcode colours are deterministic — compute once
  const barMap = useMemo(() => {
    const m: Record<string, string[]> = {
      prev: bars(7777, 16, true),
      nonce: bars(4242, 10),
      root: bars(1, 16),
    };
    for (const h of HASH_NODES) m[h.id] = bars(h.seed, h.n);
    return m;
  }, []);

  const nodeHot = (id: NodeId): boolean => {
    if (pruned) return false;
    if (effLevel === 0) return id === "h0" || id === "h1" || id === "h2" || id === "h3";
    if (effLevel === 1) return id === "h01" || id === "h23";
    return id === "root"; // level 2 & 3
  };
  const edgeHot = (lvl: number): boolean => !pruned && lvl === effLevel && effLevel < 3;

  const rootDone = !pruned && effLevel >= 2;

  // ---- small render helpers (close over state) ----

  const Barcode = (x: number, y: number, w: number, h: number, cols: string[]) => {
    const bw = w / cols.length;
    return (
      <g>
        {cols.map((c, i) => (
          <rect key={i} x={x + i * bw} y={y} width={bw + 0.6} height={h} fill={c} />
        ))}
      </g>
    );
  };

  const edgeEls = EDGES.map(([from, to, lvl]) => {
    const a = P[from];
    const b = P[to];
    const x1 = a.cx;
    const y1 = a.cy - a.hh;
    const x2 = to === "root" ? b.cx + (from === "h01" ? -18 : 18) : b.cx;
    const y2 = b.cy + b.hh;
    const key = `${from}>${to}`;
    const dropped = pruned && DROPPED.has(from);
    const proof = pruned && PROOF_EDGES.has(key);
    const hot = edgeHot(lvl);
    const stroke = proof || hot ? C.accent : dropped ? C.border : C.faint;
    const width = proof || hot ? 2 : 1.1;
    const marker = proof || hot ? "url(#mkHot)" : "url(#mkDim)";
    return (
      <line
        key={key}
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={stroke}
        strokeWidth={width}
        markerEnd={marker}
        opacity={dropped ? 0.16 : 1}
        style={{ transition: "stroke 0.3s, opacity 0.3s, stroke-width 0.3s" }}
      />
    );
  });

  const hashEls = HASH_NODES.map((h) => {
    const p = P[h.id];
    const dim = pruned && DROPPED.has(h.id);
    const hot = nodeHot(h.id);
    const keep = pruned && PROOF_NODES.has(h.id);
    const stroke = hot || keep ? C.accent : C.border;
    return (
      <g key={h.id} opacity={dim ? 0.16 : 1} style={{ transition: "opacity 0.3s" }}>
        <text
          x={p.cx}
          y={p.cy - p.hh - 5}
          textAnchor="middle"
          fontSize="10.5"
          fill={hot || keep ? C.accent : C.muted}
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
          stroke={stroke}
          strokeWidth={hot || keep ? 2 : 1}
          style={{ transition: "stroke 0.3s, stroke-width 0.3s" }}
        />
        {Barcode(p.cx - p.hw + 6, p.cy - 7, p.hw * 2 - 12, 14, barMap[h.id])}
        <text
          x={p.cx}
          y={p.cy + p.hh + 11}
          textAnchor="middle"
          fontSize="8"
          fill={C.faint}
          letterSpacing="0.5"
        >
          {hex(h.seed)}
        </text>
      </g>
    );
  });

  const txEls = TX_NODES.map((t) => {
    const p = P[t.id];
    const dim = pruned && DROPPED.has(t.id);
    const keep = pruned && PROOF_NODES.has(t.id);
    const col = feeToColor(t.fee);
    return (
      <g key={t.id} opacity={dim ? 0.16 : 1} style={{ transition: "opacity 0.3s" }}>
        <rect
          x={p.cx - p.hw}
          y={p.cy - p.hh}
          width={p.hw * 2}
          height={p.hh * 2}
          fill={col}
          fillOpacity={0.22}
          stroke={keep ? C.accent : col}
          strokeWidth={keep ? 2 : 1.2}
          style={{ transition: "stroke 0.3s, stroke-width 0.3s" }}
        />
        <text
          x={p.cx}
          y={p.cy - 1}
          textAnchor="middle"
          fontSize="12"
          fill={C.fg}
          fontWeight="600"
        >
          {t.label}
        </text>
        <text x={p.cx} y={p.cy + 12} textAnchor="middle" fontSize="7.5" fill={C.faint}>
          {hex(t.seed, 10)}
        </text>
      </g>
    );
  });

  // header sub-field (prev hash / nonce)
  const headerField = (
    label: string,
    cx: number,
    w: number,
    cols: string[],
    grey = false,
  ) => (
    <g>
      <text x={cx} y={81} textAnchor="middle" fontSize="9.5" fill={C.muted}>
        {label}
      </text>
      <rect
        x={cx - w / 2}
        y={86}
        width={w}
        height={20}
        fill={C.bg}
        stroke={C.border}
        strokeWidth={1}
      />
      {Barcode(cx - w / 2 + 5, 90, w - 10, 12, cols)}
      <text x={cx} y={118} textAnchor="middle" fontSize="7.5" fill={C.faint}>
        {grey ? "0000…" + hex(7777, 4) : hex(4242, 8)}
      </text>
    </g>
  );

  const status = pruned
    ? "pruned — keep Tx3 + two sibling hashes (Hash2, Hash01); drop Tx0–Tx2. The root still checks out."
    : [
        "hash each transaction → its own leaf hash",
        "hash the leaves in pairs → Hash01, Hash23",
        "hash that pair → the Merkle root",
        "one 32-byte root now fingerprints all four transactions",
      ][effLevel];

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="border border-border bg-panel p-3 sm:p-4">
        <svg
          viewBox="0 0 680 452"
          className="h-auto w-full"
          style={{ fontFamily: "var(--font-mono)" }}
          role="img"
          aria-label="A Merkle tree: four transactions hashed in pairs up to a single Merkle root in the block header."
        >
          <defs>
            <marker
              id="mkDim"
              markerWidth="8"
              markerHeight="8"
              refX="5.6"
              refY="3"
              orient="auto"
            >
              <path d="M0,0 L6,3 L0,6 Z" fill={C.faint} />
            </marker>
            <marker
              id="mkHot"
              markerWidth="8"
              markerHeight="8"
              refX="5.6"
              refY="3"
              orient="auto"
            >
              <path d="M0,0 L6,3 L0,6 Z" fill={C.accent} />
            </marker>
          </defs>

          {/* outer block */}
          <rect x={10} y={12} width={660} height={430} fill="none" stroke={C.border} />
          <text x={22} y={30} fontSize="11" fill={C.muted}>
            Block
          </text>

          {/* block header */}
          <rect x={46} y={42} width={588} height={90} fill="none" stroke={C.border} />
          <text x={340} y={58} textAnchor="middle" fontSize="10.5" fill={C.faint}>
            Block Header · Block Hash
          </text>
          {headerField("Prev Hash", 150, 150, barMap.prev, true)}
          {headerField("Nonce", 530, 110, barMap.nonce)}

          {/* root hash (target of the tree) */}
          <text
            x={340}
            y={P.root.cy - P.root.hh - 5}
            textAnchor="middle"
            fontSize="10.5"
            fill={rootDone || pruned ? C.accent : C.muted}
            style={{ transition: "fill 0.3s" }}
          >
            Root Hash · Merkle root
          </text>
          <rect
            x={P.root.cx - P.root.hw}
            y={P.root.cy - P.root.hh}
            width={P.root.hw * 2}
            height={P.root.hh * 2}
            fill={C.bg}
            stroke={rootDone || pruned ? C.accent : C.border}
            strokeWidth={rootDone || pruned ? 2 : 1}
            style={{ transition: "stroke 0.3s, stroke-width 0.3s" }}
          />
          {Barcode(P.root.cx - P.root.hw + 8, P.root.cy - 7, P.root.hw * 2 - 16, 14, barMap.root)}

          {/* edges then nodes */}
          {edgeEls}
          {hashEls}
          {txEls}
        </svg>
      </div>

      {/* controls + live status */}
      <div className="flex flex-wrap items-center gap-3">
        <Btn onClick={() => setPruned((v) => !v)} variant={pruned ? "primary" : "ghost"}>
          {pruned ? "[ restore full tree ]" : "[ prune Tx0–2 ]"}
        </Btn>
        <span className="font-mono text-xs text-faint">
          stored:{" "}
          <span className="text-fg">
            {pruned ? "1 transaction + 2 hashes" : "4 transactions"}
          </span>
        </span>
        <span className="flex-1 min-w-[16rem] font-mono text-xs text-muted">
          <span className="text-accent">{"» "}</span>
          {status}
        </span>
      </div>

      {/* two takeaways */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="border border-border bg-panel/50 p-3">
          <span className="font-mono text-xs text-accent">folding</span>
          <p className="mt-1 text-sm leading-relaxed text-muted">
            Pair up, hash, repeat. N transactions collapse into ⌈log₂N⌉ levels and a
            single root. Change <span className="text-fg">any</span> transaction and the
            root changes completely — tamper-evidence for free.
          </p>
        </div>
        <div className="border border-border bg-panel/50 p-3">
          <span className="font-mono text-xs text-accent">reclaiming space</span>
          <p className="mt-1 text-sm leading-relaxed text-muted">
            To prove a transaction is in a block you only need its branch — about a dozen
            hashes even for a block of thousands. The rest can be pruned; the header&apos;s
            80 bytes are enough to keep verifying.
          </p>
        </div>
      </div>
    </div>
  );
}
