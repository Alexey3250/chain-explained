"use client";

import { motion } from "motion/react";
import { useMemo, useState, type ReactNode } from "react";
import { BlackBox, Gears } from "@/components/HashMachine";
import { shaTrace } from "@/lib/sha256-rounds";

/* A full-bleed section that reveals as it scrolls into view. */
function Section({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      className={`flex min-h-[82vh] flex-col items-center justify-center text-center ${className}`}
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
    setPrevDigest(trace.digest); // digest of the previous text
    setMsg(value);
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-6">
      {/* ---------- 1 · HERO ---------- */}
      <Section className="pt-10">
        <div className="mb-3 text-xs font-semibold uppercase tracking-[0.25em] text-accent">
          The hash
        </div>
        <h2 className="text-balance text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl">
          Anything in.
          <br />
          <span className="text-accent">A fingerprint out.</span>
        </h2>
        <p className="mt-5 max-w-xl text-pretty text-lg text-muted">
          Type anything below. You get back a unique 64-character fingerprint —
          instantly, every time.
        </p>

        <div className="mt-9 w-full max-w-2xl">
          <input
            value={msg}
            onChange={(e) => onType(e.target.value)}
            spellCheck={false}
            maxLength={55}
            placeholder="type anything…"
            className="w-full rounded-2xl border border-border bg-bg-soft px-5 py-4 text-center font-mono text-lg text-fg outline-none transition focus:border-accent"
          />
          <div className="mt-5 break-all font-mono text-sm leading-relaxed sm:text-base">
            {[...trace.digest].map((c, i) => (
              <span
                key={i}
                className={
                  prevDigest && prevDigest[i] !== c ? "text-accent" : "text-muted"
                }
              >
                {c}
              </span>
            ))}
          </div>
          <p className="mt-4 text-sm text-faint">
            Change a single letter — almost every character flips. Nothing about
            the new fingerprint hints at the old one.
          </p>
        </div>
      </Section>

      {/* ---------- 2 · THE MACHINE ---------- */}
      <Section>
        <h2 className="text-balance text-3xl font-extrabold tracking-tight sm:text-5xl">
          How? A tiny machine
          <br />
          called <span className="text-accent">SHA-256</span>.
        </h2>
        <p className="mt-4 max-w-xl text-pretty text-lg text-muted">
          It scrambles your input 64 times until the result looks like pure
          noise. The beautiful part: you never have to understand the gears.
        </p>

        <div className="mt-10 w-full">
          <BlackBox trace={trace} msg={msg} />
        </div>

        <button
          type="button"
          onClick={() => setShowGears((s) => !s)}
          className="mt-8 text-sm text-muted underline decoration-dotted underline-offset-4 transition hover:text-accent"
        >
          {showGears ? "▴ Hide the gears" : "▾ Curious? Look inside the machine"}
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
        <div className="mb-2 text-xs font-semibold uppercase tracking-[0.25em] text-accent">
          Why Bitcoin needs it
        </div>
        <h2 className="text-balance text-3xl font-extrabold tracking-tight sm:text-5xl">
          Three superpowers,
          <br />
          three jobs.
        </h2>

        <div className="mt-12 w-full max-w-2xl space-y-12 text-left">
          <Power
            prop="It only runs one way."
            use="So mining is real work — you can't reverse a target back into the answer, you have to guess, trillions of times."
          />
          <Power
            prop="Everyone gets the same answer."
            use="So the whole world agrees which blocks are valid, with no bank or referee in the middle."
          />
          <Power
            prop="No two inputs ever collide."
            use="So nobody can forge a fake transaction that passes as a real one. Every fingerprint is one-of-a-kind."
          />
        </div>
      </Section>

      {/* ---------- 4 · CLOSING ---------- */}
      <Section className="pb-24">
        <h2 className="text-balance text-3xl font-extrabold leading-tight tracking-tight sm:text-5xl">
          SHA-256 replaces
          <br />
          <span className="text-muted line-through decoration-2">trust me</span>{" "}
          with{" "}
          <span className="text-accent">check it yourself.</span>
        </h2>
        <p className="mt-5 max-w-lg text-pretty text-muted">
          One little machine, quietly holding the whole system honest.
        </p>
      </Section>
    </div>
  );
}

function Power({ prop, use }: { prop: string; use: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.6 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
    >
      <h3 className="text-balance text-2xl font-bold tracking-tight sm:text-3xl">
        {prop}
      </h3>
      <p className="mt-2 text-pretty text-lg text-muted">{use}</p>
    </motion.div>
  );
}
