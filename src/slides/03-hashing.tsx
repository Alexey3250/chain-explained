"use client";

import { useEffect, useState } from "react";
import { SlideShell } from "@/components/SlideShell";
import { Panel, Pill, Reveal } from "@/components/ui";
import { sha256Hex } from "@/lib/hash";

export default function Hashing() {
  const [text, setText] = useState("Bitcoin");
  // keep current + previous hash together so we can highlight what changed
  const [{ hash, prev }, setHashes] = useState({ hash: "", prev: "" });

  useEffect(() => {
    let alive = true;
    sha256Hex(text).then((h) => {
      if (alive) setHashes((s) => ({ hash: h, prev: s.hash }));
    });
    return () => {
      alive = false;
    };
  }, [text]);

  return (
    <SlideShell
      kicker="Foundation 1 · The hash"
      title="The one tool everything is built on"
      lede="A hash function takes any input and crunches it into a fixed-length fingerprint. Type below — the fingerprint updates instantly."
    >
      <div className="grid flex-1 items-start gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <Reveal>
          <Panel className="p-6">
            <label className="text-xs font-semibold uppercase tracking-widest text-faint">
              Your input
            </label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={3}
              spellCheck={false}
              className="mt-2 w-full resize-none rounded-xl border border-border bg-bg-soft px-4 py-3 font-mono text-sm text-fg outline-none focus:border-accent"
              placeholder="Type anything…"
            />

            <div className="mt-5 flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-widest text-faint">
                SHA-256 fingerprint
              </label>
              <Pill tone="accent">256 bits · 64 hex chars</Pill>
            </div>
            <div className="mt-2 rounded-xl border border-accent/30 bg-accent/5 p-4 font-mono text-sm leading-relaxed">
              {hash
                ? [...hash].map((c, i) => (
                    <span
                      key={i}
                      className={
                        prev && prev[i] !== c ? "text-accent" : "text-muted"
                      }
                    >
                      {c}
                    </span>
                  ))
                : "…"}
            </div>
            <p className="mt-3 text-xs text-faint">
              Highlighted characters changed since your last keystroke. Change
              one letter and watch almost everything change — that&apos;s the{" "}
              <span className="text-accent">avalanche effect</span>.
            </p>
          </Panel>
        </Reveal>

        <Reveal delay={0.15} className="space-y-3">
          <Prop title="Deterministic" desc="Same input → always the same output. Every computer agrees." />
          <Prop title="One-way" desc="Easy to compute forward. Practically impossible to reverse." />
          <Prop title="Fixed size" desc="A tweet or an entire library — always 64 hex characters." />
          <Prop title="Avalanche" desc="The tiniest change scrambles the whole fingerprint." />
          <p className="pt-1 text-sm text-muted">
            Hold onto this. Hashes are how Bitcoin links blocks, proves work, and
            makes tampering obvious — all coming up next.
          </p>
        </Reveal>
      </div>
    </SlideShell>
  );
}

function Prop({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="rounded-xl border border-border bg-panel/50 p-4">
      <div className="font-semibold text-fg">{title}</div>
      <div className="mt-0.5 text-sm text-muted">{desc}</div>
    </div>
  );
}
