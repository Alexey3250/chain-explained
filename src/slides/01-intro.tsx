"use client";

import { motion } from "motion/react";
import { SlideShell } from "@/components/SlideShell";
import { Pill } from "@/components/ui";

export default function Intro() {
  return (
    <div className="starfield h-full">
      <SlideShell center>
        <motion.div
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="mb-8"
        >
          <Coin />
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="text-balance text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl"
        >
          How does <span className="text-accent">Bitcoin</span>
          <br />
          actually work?
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.35 }}
          className="mt-5 max-w-xl text-pretty text-lg text-muted"
        >
          No jargon, no hand-waving. We&apos;ll build it up one idea at a time —
          from a single number, all the way out to a global network that no one
          owns.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="mt-8 flex flex-wrap items-center justify-center gap-2"
        >
          <Pill tone="accent">10 short steps</Pill>
          <Pill>interactive — try things yourself</Pill>
          <Pill>real live data at the end</Pill>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1, duration: 0.8 }}
          className="mt-10 flex items-center gap-2 text-sm text-faint"
        >
          <motion.span
            animate={{ x: [0, 6, 0] }}
            transition={{ repeat: Infinity, duration: 1.4 }}
          >
            Press the arrow to begin →
          </motion.span>
        </motion.div>
      </SlideShell>
    </div>
  );
}

function Coin() {
  return (
    <motion.div
      animate={{ y: [0, -10, 0] }}
      transition={{ repeat: Infinity, duration: 3.5, ease: "easeInOut" }}
      className="relative flex h-28 w-28 items-center justify-center rounded-full"
      style={{
        background:
          "radial-gradient(circle at 35% 30%, #ffd083, #f7931a 55%, #b9650a)",
        boxShadow:
          "0 0 60px -8px rgba(247,147,26,0.7), inset 0 -6px 14px rgba(0,0,0,0.35)",
      }}
    >
      <span className="text-6xl font-bold text-[#3a2200]">₿</span>
    </motion.div>
  );
}
