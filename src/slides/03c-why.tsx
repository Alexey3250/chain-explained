"use client";

import { SlideShell } from "@/components/SlideShell";
import { Panel, Pill, Reveal } from "@/components/ui";
import type { ReactNode } from "react";

type Row = {
  icon: string;
  prop: string;
  meaning: string;
  use: ReactNode;
  tag: string;
  tone: "accent" | "blue" | "green" | "purple";
};

const ROWS: Row[] = [
  {
    icon: "⛏",
    prop: "One-way",
    meaning: "you can't run it backwards",
    use: (
      <>
        mining can&apos;t be faked — there&apos;s no shortcut, you have to{" "}
        <span className="text-fg">actually guess</span>, trillions of times.
      </>
    ),
    tag: "Proof of Work",
    tone: "accent",
  },
  {
    icon: "🎲",
    prop: "Unpredictable",
    meaning: "tiny change → total chaos",
    use: (
      <>
        mining is a <span className="text-fg">fair lottery</span> — your odds
        match your effort exactly, with no patterns to exploit.
      </>
    ),
    tag: "Fair mining",
    tone: "purple",
  },
  {
    icon: "🤝",
    prop: "Deterministic",
    meaning: "same input → same output, everywhere",
    use: (
      <>
        every computer <span className="text-fg">agrees</span> which blocks are
        valid — no bank or referee required.
      </>
    ),
    tag: "Consensus",
    tone: "blue",
  },
  {
    icon: "🛡",
    prop: "Collision-proof",
    meaning: "no two inputs share a fingerprint",
    use: (
      <>
        nobody can <span className="text-fg">forge a fake transaction</span>{" "}
        that passes as a real one.
      </>
    ),
    tag: "Tamper-proof",
    tone: "green",
  },
  {
    icon: "⚖️",
    prop: "Huge, yet cheap to check",
    meaning: "256-bit output, verified in one pass",
    use: (
      <>
        work that took <span className="text-fg">quintillions of tries</span> is
        double-checked by everyone with a single hash.
      </>
    ),
    tag: "Verify ≫ make",
    tone: "accent",
  },
];

export default function Why() {
  return (
    <SlideShell
      kicker="Foundation · Why it matters"
      title="Why Bitcoin runs on SHA-256"
      lede="One little machine quietly does five different jobs. Each one leans on a different superpower of the hash you just watched."
    >
      <div className="grid flex-1 gap-2.5">
        {ROWS.map((r, i) => (
          <Reveal key={r.prop} delay={i * 0.08}>
            <Panel className="flex flex-wrap items-center gap-x-4 gap-y-2 p-4">
              <div className="flex min-w-[180px] items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-bg-soft text-xl">
                  {r.icon}
                </span>
                <div>
                  <div className="font-semibold text-fg">{r.prop}</div>
                  <div className="text-xs text-faint">{r.meaning}</div>
                </div>
              </div>
              <span className="hidden text-accent sm:inline">→</span>
              <p className="flex-1 text-sm text-muted">{r.use}</p>
              <Pill tone={r.tone}>{r.tag}</Pill>
            </Panel>
          </Reveal>
        ))}
      </div>

      <Reveal delay={0.5}>
        <div className="mt-4 rounded-xl border border-accent/30 bg-accent/5 p-4 text-center text-pretty">
          <span className="text-base">
            In one line: SHA-256 replaces{" "}
            <span className="text-muted line-through">trust the bank</span> with{" "}
            <span className="font-semibold text-accent">
              check the math yourself
            </span>
            .
          </span>
        </div>
      </Reveal>

      <Reveal delay={0.6}>
        <p className="mt-3 text-xs text-faint">
          <span className="font-semibold text-muted">For the curious:</span>{" "}
          it&apos;s hashing, not encryption (there&apos;s nothing to decrypt) ·
          Bitcoin actually hashes everything <em>twice</em> (SHA-256²) for extra
          safety · it was picked for being simple and fast — which is also why
          mining became an ASIC arms race.
        </p>
      </Reveal>
    </SlideShell>
  );
}
