"use client";

import { motion } from "motion/react";
import { SlideShell } from "@/components/SlideShell";
import { Pill } from "@/components/ui";
import ChainMachine from "@/components/ChainMachine";

export default function Intro() {
  return (
    <SlideShell>
      <div className="mx-auto flex w-full max-w-4xl flex-col">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="font-mono text-xs leading-relaxed text-faint"
        >
          <div>
            $ ./bitcoind <span className="text-muted">--watch=mempool</span>
          </div>
          <div>
            syncing the chain <span className="text-faint">........</span>{" "}
            <span className="text-green">ok</span>
          </div>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="mt-4 font-mono text-3xl font-bold leading-tight tracking-tight sm:text-4xl"
        >
          how does <span className="text-accent">bitcoin</span> actually work?
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mt-3 max-w-2xl font-mono text-sm leading-relaxed text-muted"
        >
          payments pile up in the mempool, nodes check them, a miner packs them
          into a block, and it links onto the chain. here&apos;s that machine,
          alive — tap or hover any part to see what it does.
        </motion.p>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mt-5"
        >
          <ChainMachine mode="intro" />
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="mt-5 flex flex-wrap items-center gap-3"
        >
          <Pill tone="accent">live model</Pill>
          <Pill>10 steps</Pill>
          <span className="ml-auto font-mono text-sm text-faint">
            press <span className="text-accent">→</span> to begin{" "}
            <span className="text-accent blink">█</span>
          </span>
        </motion.div>
      </div>
    </SlideShell>
  );
}
