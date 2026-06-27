"use client";

import { motion } from "motion/react";
import { SlideShell } from "@/components/SlideShell";
import { Pill } from "@/components/ui";

const ASCII = ` ___  _____ ___
| _ )|_   _/ __|
| _ \\  | || (__
|___/  |_| \\___|`;

export default function Intro() {
  return (
    <SlideShell center>
      <motion.pre
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
        className="mb-7 select-none text-left font-mono text-[0.8rem] leading-tight text-accent sm:text-base"
        aria-hidden
      >
        {ASCII}
      </motion.pre>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.15 }}
        className="mb-5 text-left font-mono text-xs leading-relaxed text-faint"
      >
        <div>
          $ ./chain-explained <span className="text-muted">--topic=bitcoin</span>
        </div>
        <div>
          loading primer <span className="text-faint">................</span>{" "}
          <span className="text-green">ok</span>
        </div>
      </motion.div>

      <motion.h1
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.25 }}
        className="font-mono text-3xl font-bold leading-tight tracking-tight sm:text-5xl"
      >
        how does <span className="text-accent">bitcoin</span>
        <br />
        actually work?
      </motion.h1>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.4 }}
        className="mt-4 max-w-xl font-mono text-sm leading-relaxed text-muted"
      >
        no jargon, no hand-waving. built up one idea at a time — from a single
        number out to a global network that no one owns.
      </motion.p>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.5 }}
        className="mt-6 flex flex-wrap items-center justify-center gap-3"
      >
        <Pill tone="accent">10 steps</Pill>
        <Pill>interactive</Pill>
        <Pill>live on-chain data</Pill>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.9, duration: 0.6 }}
        className="mt-9 font-mono text-sm text-faint"
      >
        press <span className="text-accent">→</span> to begin{" "}
        <span className="text-accent blink">█</span>
      </motion.div>
    </SlideShell>
  );
}
