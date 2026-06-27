"use client";

import { motion } from "motion/react";
import { useMemo, useState, type ReactNode } from "react";
import { BlackBox, Gears } from "@/components/HashMachine";
import { AsciiRule, Panel } from "@/components/ui";
import { shaTrace } from "@/lib/sha256-rounds";

function Section({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className={`flex min-h-[72vh] flex-col items-center justify-center ${className}`}
    >
      {children}
    </motion.section>
  );
}

export default function Hash() {
  const [msg, setMsg] = useState("Bitcoin");
  const [prevDigest, setPrevDigest] = useState("");
  const [showGears, setShowGears] = useState(false);

  const trace = useMemo(() => shaTrace(msg), [msg]);

  function onType(value: string) {
    setPrevDigest(trace.digest);
    setMsg(value);
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-6 font-mono">
      {/* ---------- 1 · HERO ---------- */}
      <Section className="pt-10 text-center">
        <div className="mb-3 text-xs tracking-wide text-accent">{"// the hash"}</div>
        <h2 className="text-2xl font-bold leading-tight tracking-tight sm:text-4xl">
          anything in.{" "}
          <span className="text-accent">a fingerprint out.</span>
        </h2>
        <p className="mx-auto mt-4 max-w-lg text-sm leading-relaxed text-muted">
          a hash takes any input and crunches it into a fixed 64-character
          fingerprint — instantly, every time.
        </p>

        <Panel className="mt-8 w-full max-w-2xl p-4 text-left">
          <div className="mb-3 text-xs text-faint">
            {"// type anything — sha-256 runs live"}
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-green">$</span>
            <span className="text-faint">sha256(&quot;</span>
            <input
              value={msg}
              onChange={(e) => onType(e.target.value)}
              spellCheck={false}
              maxLength={55}
              className="min-w-0 flex-1 bg-transparent text-fg outline-none"
            />
            <span className="text-faint">&quot;)</span>
          </div>
          <div className="mt-3 break-all text-sm">
            <span className="text-faint">=&gt; </span>
            {[...trace.digest].map((c, i) => (
              <span
                key={i}
                className={prevDigest && prevDigest[i] !== c ? "text-accent" : "text-fg"}
              >
                {c}
              </span>
            ))}
          </div>
        </Panel>
        <p className="mt-4 max-w-lg text-xs leading-relaxed text-faint">
          change one letter — almost every character flips, and nothing about the
          new fingerprint hints at the old one.
        </p>
      </Section>

      {/* ---------- 2 · THE MACHINE ---------- */}
      <Section>
        <AsciiRule label="how" />
        <h2 className="mt-8 text-center text-xl font-bold tracking-tight sm:text-3xl">
          a tiny machine called <span className="text-accent">sha-256</span>
        </h2>
        <p className="mx-auto mt-3 max-w-lg text-center text-sm leading-relaxed text-muted">
          it scrambles your input 64 times until the result looks like noise. the
          point: you never have to understand the gears.
        </p>

        <div className="mt-9 w-full">
          <BlackBox trace={trace} msg={msg} />
        </div>

        <button
          type="button"
          onClick={() => setShowGears((s) => !s)}
          className="mt-7 self-center text-sm text-muted underline decoration-dotted underline-offset-4 transition hover:text-accent"
        >
          {showGears ? "[-] hide the gears" : "[+] look inside the machine"}
        </button>

        {showGears && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-6 w-full"
          >
            <Gears trace={trace} msg={msg} />
          </motion.div>
        )}
      </Section>

      {/* ---------- 3 · WHY IT MATTERS ---------- */}
      <Section>
        <AsciiRule label="why bitcoin needs it" />
        <div className="mt-10 w-full max-w-2xl space-y-9">
          <Power
            prop="it only runs one way"
            use="so mining is real work — you can't reverse a target back into the answer, you have to guess, trillions of times."
          />
          <Power
            prop="everyone gets the same answer"
            use="so the whole world agrees which blocks are valid, with no bank or referee in the middle."
          />
          <Power
            prop="no two inputs ever collide"
            use="so nobody can forge a fake transaction that passes as a real one. every fingerprint is one-of-a-kind."
          />
        </div>
      </Section>

      {/* ---------- 4 · CLOSING ---------- */}
      <Section className="pb-24 text-center">
        <AsciiRule />
        <h2 className="mt-8 text-xl font-bold leading-snug tracking-tight sm:text-3xl">
          sha-256 replaces{" "}
          <span className="text-faint line-through">trust me</span>
          <br />
          with <span className="text-accent">check it yourself.</span>
        </h2>
        <p className="mx-auto mt-4 max-w-md text-sm text-muted">
          one little machine, quietly holding the whole system honest.
        </p>
      </Section>
    </div>
  );
}

function Power({ prop, use }: { prop: string; use: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.6 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
    >
      <h3 className="text-lg font-bold tracking-tight sm:text-2xl">
        <span className="text-accent">&gt;</span> {prop}
      </h3>
      <p className="mt-2 pl-4 text-sm leading-relaxed text-muted sm:text-base">
        {use}
      </p>
    </motion.div>
  );
}
