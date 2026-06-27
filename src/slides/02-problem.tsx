"use client";

import { motion } from "motion/react";
import { SlideShell } from "@/components/SlideShell";
import { Panel, Pill, Reveal } from "@/components/ui";

export default function Problem() {
  return (
    <SlideShell
      kicker="The problem"
      title="Why is digital money so hard?"
      lede="Physical cash is easy: I hand you a coin, now I don't have it. But a digital coin is just a file — and files copy perfectly."
    >
      <div className="grid flex-1 items-center gap-6 lg:grid-cols-2">
        <Reveal>
          <Panel className="p-6">
            <Pill tone="red">The double-spend problem</Pill>
            <div className="mt-5">
              <DoubleSpend />
            </div>
            <p className="mt-5 text-sm text-muted">
              Alice has one coin. What stops her from sending the{" "}
              <span className="text-fg">same</span> coin to both Bob and Carol?
              Nothing — unless someone keeps a definitive record of who owns
              what.
            </p>
          </Panel>
        </Reveal>

        <Reveal delay={0.15} className="space-y-4">
          <p className="text-lg text-fg">
            The usual fix is a <span className="text-accent">trusted middleman</span>{" "}
            — a bank — who keeps the one true ledger and updates everyone&apos;s
            balance.
          </p>
          <p className="text-muted">
            But that means trusting them to be honest, online, and fair. They can
            freeze you, reverse you, or simply make a mistake.
          </p>
          <div className="rounded-xl border border-accent/30 bg-accent/5 p-4">
            <p className="text-pretty">
              <span className="font-semibold text-accent">
                Bitcoin&apos;s bet:
              </span>{" "}
              what if <em>everyone</em> kept the same ledger, and math — not a
              company — decided what&apos;s true?
            </p>
          </div>
          <p className="text-sm text-faint">
            The rest of this walkthrough is just the tools that make that
            possible.
          </p>
        </Reveal>
      </div>
    </SlideShell>
  );
}

function DoubleSpend() {
  return (
    <div className="flex items-center justify-between gap-2 text-center">
      <Actor label="Alice" emoji="👩" />
      <div className="relative flex flex-1 flex-col items-center">
        <motion.div
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 30, opacity: [0, 1, 1, 0] }}
          transition={{ repeat: Infinity, duration: 2.4, times: [0, 0.2, 0.8, 1] }}
          className="absolute -top-6 text-2xl"
        >
          🪙
        </motion.div>
        <motion.div
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 30, opacity: [0, 1, 1, 0] }}
          transition={{
            repeat: Infinity,
            duration: 2.4,
            delay: 0.4,
            times: [0, 0.2, 0.8, 1],
          }}
          className="absolute top-6 text-2xl"
        >
          🪙
        </motion.div>
        <div className="h-px w-full bg-gradient-to-r from-transparent via-red to-transparent" />
        <span className="mt-2 text-xs text-red">same coin, twice?</span>
      </div>
      <div className="flex flex-col gap-3">
        <Actor label="Bob" emoji="🧑" />
        <Actor label="Carol" emoji="👧" />
      </div>
    </div>
  );
}

function Actor({ label, emoji }: { label: string; emoji: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-panel-2 text-2xl">
        {emoji}
      </div>
      <span className="text-xs text-muted">{label}</span>
    </div>
  );
}
