"use client";

import { motion } from "motion/react";
import { SlideShell } from "@/components/SlideShell";
import { Panel, Pill } from "@/components/ui";

export default function Problem() {
  return (
    <SlideShell
      kicker="the problem"
      title="the one problem bitcoin exists to solve"
      lede="money is really just a ledger — a record of who owns what. cash works because handing over a coin updates that record automatically: you give it, you no longer have it."
    >
      <div className="flex flex-col gap-6">
        <div className="grid items-start gap-6 lg:grid-cols-2">
          {/* the attack, drawn flat */}
          <Panel className="p-5">
            <Pill tone="red">double-spend</Pill>
            <div className="mt-5">
              <DoubleSpend />
            </div>
            <p className="mt-5 font-mono text-xs leading-relaxed text-muted">
              a digital coin is just data — and data copies perfectly. so
              &quot;sending&quot; it doesn&apos;t stop alice keeping a copy and
              spending the <span className="text-fg">same coin</span> again. spend
              it enough times and the money becomes worthless.
            </p>
          </Panel>

          {/* the argument, step by step */}
          <div className="space-y-3">
            <Step
              n="01"
              t="the easy fix: a referee"
              d="a bank keeps the single official ledger and crosses your coin off the moment you pay. one source of truth, problem solved."
            />
            <Step
              n="02"
              t="but bitcoin wants no referee"
              d="no bank, no company, no off-switch. remove the referee, though, and nothing is left to stop the double-spend…"
            />
            <Step
              n="03"
              t="…unless strangers can agree"
              d="the only way out: get a leaderless network to agree on one shared history of who paid whom, in what order."
              accent
            />
          </div>
        </div>

        {/* the punchline that motivates the whole deck */}
        <Panel className="border-accent/50 p-5">
          <p className="font-mono text-sm leading-relaxed">
            <span className="text-accent">that agreement is the whole game.</span>{" "}
            everything else in this walkthrough — hashing, blocks, mining, the
            chain — is the machine built to win it. solve double-spending without
            a boss, and you&apos;ve built bitcoin.
          </p>
        </Panel>
      </div>
    </SlideShell>
  );
}

function Step({
  n,
  t,
  d,
  accent = false,
}: {
  n: string;
  t: string;
  d: string;
  accent?: boolean;
}) {
  return (
    <div className={`border-l-2 pl-3 ${accent ? "border-accent" : "border-border"}`}>
      <div className="font-mono text-sm">
        <span className="text-faint">{n}</span>{" "}
        <span className={accent ? "text-accent" : "text-fg"}>{t}</span>
      </div>
      <p className="mt-1 font-mono text-xs leading-relaxed text-muted">{d}</p>
    </div>
  );
}

function DoubleSpend() {
  return (
    <div className="font-mono text-sm">
      <div className="grid grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-3">
        {/* alice */}
        <div className="row-span-2 border border-border bg-bg-soft px-3 py-2 text-center">
          <div className="text-blue">alice</div>
          <div className="text-[0.65rem] text-faint">1 coin</div>
        </div>

        {/* arrow to bob */}
        <Wire delay={0} />
        <div className="border border-border bg-bg-soft px-3 py-2 text-center">
          <div className="text-fg">bob</div>
          <div className="text-[0.65rem] text-green">paid ✓</div>
        </div>

        {/* arrow to carol */}
        <Wire delay={0.4} />
        <div className="border border-red/50 bg-bg-soft px-3 py-2 text-center">
          <div className="text-fg">carol</div>
          <div className="text-[0.65rem] text-red">…also paid?</div>
        </div>
      </div>
      <div className="mt-3 text-center text-[0.7rem] text-red">
        ▲ the same coin, sent twice
      </div>
    </div>
  );
}

function Wire({ delay }: { delay: number }) {
  return (
    <div className="relative flex items-center">
      <div className="h-px w-full bg-border" />
      <motion.span
        initial={{ left: "0%", opacity: 0 }}
        animate={{ left: "85%", opacity: [0, 1, 1, 0] }}
        transition={{ repeat: Infinity, duration: 2, delay, times: [0, 0.15, 0.85, 1] }}
        className="absolute -top-2 text-accent"
      >
        ¢
      </motion.span>
      <span className="absolute right-0 text-faint">▸</span>
    </div>
  );
}
