"use client";

import { motion } from "motion/react";
import { SlideShell } from "@/components/SlideShell";
import { Pill } from "@/components/ui";
import Replisome from "@/components/Replisome";

const REPO = "https://github.com/Alexey3250/chain-explained";

export default function Outro() {
  return (
    <SlideShell>
      <div className="mx-auto flex w-full max-w-4xl flex-col">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="font-mono text-sm text-green"
        >
          replication complete <span className="text-faint">— the chain lives</span>
        </motion.div>

        <h2 className="mt-2 font-mono text-2xl font-bold tracking-tight sm:text-4xl">
          you now know how bitcoin works.
        </h2>

        <p className="mt-3 max-w-2xl font-mono text-sm leading-relaxed text-muted">
          the whole machine, running at once: helicase = proof-of-work, the
          template = every node, polymerase = miners, Okazaki fragments = blocks,
          ligase = the prev-hash links. hover any part to check you recognise it.
        </p>

        <div className="mt-5">
          <Replisome mode="outro" />
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Pill tone="accent">next: ethereum</Pill>
          <a
            href={REPO}
            target="_blank"
            rel="noopener noreferrer"
            className="border border-accent px-3.5 py-2 font-mono text-sm text-accent transition hover:bg-accent hover:text-[#0b0c10]"
          >
            [ view source ]
          </a>
          <a
            href="#intro"
            className="border border-border px-3.5 py-2 font-mono text-sm text-muted transition hover:border-fg hover:text-fg"
          >
            [ start over ]
          </a>
        </div>
      </div>
    </SlideShell>
  );
}
