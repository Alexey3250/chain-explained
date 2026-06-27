"use client";

import { motion } from "motion/react";
import { SlideShell } from "@/components/SlideShell";
import { Panel, Reveal } from "@/components/ui";

const NODES = [
  { x: 50, y: 18 },
  { x: 80, y: 32 },
  { x: 84, y: 66 },
  { x: 58, y: 84 },
  { x: 26, y: 78 },
  { x: 14, y: 44 },
  { x: 38, y: 48 },
  { x: 66, y: 52 },
];

// edges as index pairs
const EDGES = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [4, 5],
  [5, 0],
  [6, 0],
  [6, 4],
  [6, 7],
  [7, 1],
  [7, 2],
  [7, 3],
];

export default function Network() {
  return (
    <SlideShell
      kicker="The network · Consensus"
      title="No headquarters. Just thousands of equals."
      lede="Every node keeps its own full copy of the chain and checks every rule itself. A new block ripples out to all of them in seconds."
    >
      <div className="grid flex-1 items-center gap-6 lg:grid-cols-2">
        <Reveal>
          <Panel className="relative aspect-square w-full max-w-md p-4" glow>
            <svg viewBox="0 0 100 100" className="h-full w-full overflow-visible">
              {EDGES.map(([a, b], i) => (
                <line
                  key={i}
                  x1={NODES[a].x}
                  y1={NODES[a].y}
                  x2={NODES[b].x}
                  y2={NODES[b].y}
                  stroke="var(--border)"
                  strokeWidth={0.5}
                />
              ))}
            </svg>
            {NODES.map((n, i) => (
              <motion.span
                key={i}
                className="absolute flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-lg border border-accent/50 bg-panel-2 text-xs"
                style={{ left: `${n.x}%`, top: `${n.y}%` }}
                animate={{
                  boxShadow: [
                    "0 0 0px 0px rgba(247,147,26,0)",
                    "0 0 18px 2px rgba(247,147,26,0.7)",
                    "0 0 0px 0px rgba(247,147,26,0)",
                  ],
                  borderColor: [
                    "rgba(247,147,26,0.3)",
                    "rgba(247,147,26,1)",
                    "rgba(247,147,26,0.3)",
                  ],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  delay: (i * 0.22) % 2,
                  ease: "easeInOut",
                }}
              >
                🖥
              </motion.span>
            ))}
            <span className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[0.7rem] text-faint">
              a new block propagating
            </span>
          </Panel>
        </Reveal>

        <Reveal delay={0.15} className="space-y-4">
          <Item
            title="Everyone validates"
            desc="A node rejects any block that breaks the rules — bad signature, wrong reward, invalid proof of work. Cheating simply gets ignored."
          />
          <Item
            title="The longest valid chain wins"
            desc="If two blocks appear at once, nodes build on whichever chain gets longer first. Disagreements resolve on their own."
          />
          <Item
            title="To rewrite history…"
            desc="…you'd need more mining power than everyone else combined — and keep it up forever. That's the famous '51%' bar."
          />
          <p className="text-sm text-faint">
            No CEO, no server to seize, no off switch. The ledger is wherever the
            nodes are — which is everywhere.
          </p>
        </Reveal>
      </div>
    </SlideShell>
  );
}

function Item({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="rounded-xl border border-border bg-panel/50 p-4">
      <div className="font-semibold text-fg">{title}</div>
      <div className="mt-0.5 text-sm text-muted">{desc}</div>
    </div>
  );
}
