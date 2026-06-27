"use client";

import { motion } from "motion/react";
import { SlideShell } from "@/components/SlideShell";
import { Panel, Pill, Reveal } from "@/components/ui";

export default function Transactions() {
  return (
    <SlideShell
      kicker="Money · Transactions"
      title="A payment is just inputs and outputs"
      lede="Bitcoin has no account balances. Instead, coins exist as chunks of value you received. To spend, you point at old chunks (inputs) and create new ones (outputs)."
    >
      <div className="grid flex-1 items-center gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <Reveal>
          <Panel className="p-6" glow>
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
              {/* inputs */}
              <div className="space-y-3">
                <Pill tone="blue">Inputs (coins you own)</Pill>
                <Chunk amount="0.40 BTC" note="from Mining reward" />
                <Chunk amount="0.18 BTC" note="from Dana" />
                <div className="text-right text-xs text-faint">
                  total in: 0.58 BTC
                </div>
              </div>

              {/* arrow + tx */}
              <div className="flex flex-col items-center gap-2">
                <motion.div
                  animate={{ x: [0, 6, 0] }}
                  transition={{ repeat: Infinity, duration: 1.6 }}
                  className="text-2xl text-accent"
                >
                  →
                </motion.div>
                <div className="rounded-lg border border-accent/40 bg-accent/10 px-3 py-1 text-xs font-semibold text-accent">
                  TX
                </div>
              </div>

              {/* outputs */}
              <div className="space-y-3">
                <Pill tone="green">Outputs (new coins)</Pill>
                <Chunk amount="0.50 BTC" note="to Bob" tone="green" />
                <Chunk amount="0.0792 BTC" note="back to you (change)" tone="green" />
                <div className="text-right text-xs text-faint">
                  fee: 0.0008 BTC ⛏
                </div>
              </div>
            </div>
          </Panel>
        </Reveal>

        <Reveal delay={0.15} className="space-y-4">
          <Point
            n="1"
            text="Inputs must be whole, unspent chunks — you can't spend half of one."
          />
          <Point
            n="2"
            text="So you over-pay, then send the leftover back to yourself as 'change'."
          />
          <Point
            n="3"
            text="Whatever you don't assign to an output becomes the miner's fee."
          />
          <div className="rounded-xl border border-border bg-panel/50 p-4 text-sm text-muted">
            Each input carries a <span className="text-fg">signature</span> (the
            previous slide!) proving you&apos;re allowed to spend it. No
            signature, no spend.
          </div>
        </Reveal>
      </div>
    </SlideShell>
  );
}

function Chunk({
  amount,
  note,
  tone = "blue",
}: {
  amount: string;
  note: string;
  tone?: "blue" | "green";
}) {
  const border = tone === "blue" ? "border-blue/30" : "border-green/30";
  const text = tone === "blue" ? "text-blue" : "text-green";
  return (
    <div className={`rounded-lg border ${border} bg-bg-soft px-3 py-2`}>
      <div className={`font-mono text-sm font-semibold ${text}`}>{amount}</div>
      <div className="text-[0.7rem] text-faint">{note}</div>
    </div>
  );
}

function Point({ n, text }: { n: string; text: string }) {
  return (
    <div className="flex gap-3">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-accent/40 bg-accent/10 text-xs font-bold text-accent">
        {n}
      </span>
      <p className="text-sm text-muted">{text}</p>
    </div>
  );
}
