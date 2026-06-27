"use client";

import { motion } from "motion/react";
import { SlideShell } from "@/components/SlideShell";
import { Pill } from "@/components/ui";

const REPO = "https://github.com/Alexey3250/chain-explained";

export default function Outro() {
  return (
    <SlideShell center>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="mb-6 font-mono text-sm text-green"
      >
        process complete <span className="text-faint">— exit code 0</span>
      </motion.div>

      <h2 className="font-mono text-2xl font-bold tracking-tight sm:text-4xl">
        you now know how bitcoin works.
      </h2>

      <p className="mt-4 max-w-xl font-mono text-sm leading-relaxed text-muted">
        a hash, a key, a signed transaction, a mined block, a chain no one can
        rewrite, agreed on by a worldwide network. that&apos;s the whole machine
        — built one idea at a time.
      </p>

      <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
        <Pill tone="accent">next: ethereum &amp; smart contracts</Pill>
        <Pill>coming soon</Pill>
      </div>

      <div className="mt-9 flex flex-wrap items-center justify-center gap-3 font-mono text-sm">
        <a
          href={REPO}
          target="_blank"
          rel="noopener noreferrer"
          className="border border-accent px-3.5 py-2 text-accent transition hover:bg-accent hover:text-[#0b0c10]"
        >
          [ view source ]
        </a>
        <a
          href="#intro"
          className="border border-border px-3.5 py-2 text-muted transition hover:border-fg hover:text-fg"
        >
          [ start over ]
        </a>
      </div>

      <p className="mt-9 max-w-md font-mono text-xs leading-relaxed text-faint">
        built with next.js, motion &amp; the web crypto api. every hash and
        signature on these slides was computed for real, in your browser.
      </p>
    </SlideShell>
  );
}
