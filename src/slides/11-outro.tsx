"use client";

import { motion } from "motion/react";
import { SlideShell } from "@/components/SlideShell";
import { Pill } from "@/components/ui";

const REPO = "https://github.com/Alexey3250/chain-explained";

export default function Outro() {
  return (
    <div className="starfield h-full">
      <SlideShell center>
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6 }}
          className="mb-6 text-5xl"
        >
          🎉
        </motion.div>
        <h2 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">
          You now know how Bitcoin works.
        </h2>
        <p className="mt-4 max-w-xl text-pretty text-muted">
          A hash, a key, a signed transaction, a mined block, a chain no one can
          rewrite, agreed on by a worldwide network. That&apos;s the whole
          machine — and you built the understanding one idea at a time.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
          <Pill tone="accent">Next chapter: Ethereum &amp; smart contracts</Pill>
          <Pill>coming soon</Pill>
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-3 text-sm">
          <a
            href={REPO}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-panel/70 px-4 py-2.5 font-semibold transition hover:bg-panel-2"
          >
            ★ View the source on GitHub
          </a>
          <a
            href="#intro"
            className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-muted transition hover:text-fg"
          >
            ↺ Start over
          </a>
        </div>

        <p className="mt-10 text-xs text-faint">
          Built with Next.js, Motion &amp; the Web Crypto API. Every hash and
          signature on these slides was computed for real, in your browser.
        </p>
      </SlideShell>
    </div>
  );
}
