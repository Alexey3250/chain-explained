"use client";

import { useRef, useState } from "react";
import { SlideShell } from "@/components/SlideShell";
import { Btn, Panel, Pill, Reveal } from "@/components/ui";
import { sha256Hex } from "@/lib/hash";

const BLOCK = "Block 840,002 · Bob→Alice 0.5 BTC · prev 0000a91f · nonce:";

type Result = { nonce: number; hash: string; ms: number };

export default function Mining() {
  const [difficulty, setDifficulty] = useState(3);
  const [mining, setMining] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  const cancel = useRef(false);

  async function mine() {
    if (mining) {
      cancel.current = true;
      return;
    }
    setMining(true);
    setResult(null);
    setAttempts(0);
    cancel.current = false;
    const target = "0".repeat(difficulty);
    const start = performance.now();
    let nonce = 0;
    while (true) {
      if (cancel.current) break;
      const h = await sha256Hex(BLOCK + nonce);
      if (h.startsWith(target)) {
        setResult({ nonce, hash: h, ms: performance.now() - start });
        setAttempts(nonce + 1);
        break;
      }
      nonce++;
      if (nonce % 250 === 0) {
        setAttempts(nonce);
        await new Promise((r) => setTimeout(r, 0)); // keep the UI alive
      }
    }
    setMining(false);
  }

  return (
    <SlideShell
      kicker="Consensus · Proof of work"
      title="Mining is a guessing game"
      lede="To add a block, miners must find a nonce that makes the block's hash start with enough zeros. There's no shortcut — you just guess, billions of times."
    >
      <div className="grid flex-1 items-start gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <Reveal>
          <Panel className="p-6">
            <div className="flex items-center justify-between">
              <Pill tone="accent">Difficulty</Pill>
              <span className="font-mono text-sm text-muted">
                need {difficulty} leading zero{difficulty > 1 ? "s" : ""}
              </span>
            </div>
            <input
              type="range"
              min={1}
              max={5}
              value={difficulty}
              disabled={mining}
              onChange={(e) => setDifficulty(Number(e.target.value))}
              className="mt-3 w-full accent-[var(--accent)]"
            />
            <div className="mt-1 flex justify-between text-[0.7rem] text-faint">
              <span>easy</span>
              <span>hard (real Bitcoin needs ~19)</span>
            </div>

            <Btn onClick={mine} className="mt-5 w-full">
              {mining ? "⛏ Mining… (click to stop)" : "⛏ Start mining"}
            </Btn>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-border bg-bg-soft px-4 py-3">
                <div className="text-[0.7rem] uppercase tracking-widest text-faint">
                  guesses tried
                </div>
                <div className="mt-1 font-mono text-xl font-semibold text-fg">
                  {attempts.toLocaleString()}
                </div>
              </div>
              <div className="rounded-xl border border-border bg-bg-soft px-4 py-3">
                <div className="text-[0.7rem] uppercase tracking-widest text-faint">
                  time
                </div>
                <div className="mt-1 font-mono text-xl font-semibold text-fg">
                  {result ? `${(result.ms / 1000).toFixed(2)}s` : mining ? "…" : "—"}
                </div>
              </div>
            </div>

            {result && (
              <div className="mt-4 rounded-xl border border-green/40 bg-green/10 p-4">
                <div className="text-sm font-semibold text-green">
                  ✓ Block mined! winning nonce = {result.nonce.toLocaleString()}
                </div>
                <div className="mt-2 break-all font-mono text-xs">
                  <span className="text-green">{"0".repeat(difficulty)}</span>
                  <span className="text-muted">
                    {result.hash.slice(difficulty)}
                  </span>
                </div>
              </div>
            )}
          </Panel>
        </Reveal>

        <Reveal delay={0.15} className="space-y-4">
          <p className="text-lg text-fg">
            Hard to find, <span className="text-green">trivial to check</span>.
          </p>
          <p className="text-muted">
            Finding the nonce took millions of tries. But anyone can verify it
            with a <span className="text-fg">single</span> hash. That asymmetry
            is the whole point.
          </p>
          <div className="rounded-xl border border-border bg-panel/50 p-4 text-sm text-muted">
            Each extra zero makes mining ~16× harder. Bump the slider to 5 and
            feel it. The real network does this with purpose-built machines —
            quintillions of guesses every second.
          </div>
          <div className="rounded-xl border border-accent/30 bg-accent/5 p-4 text-sm">
            <span className="font-semibold text-accent">Why bother?</span> All
            that work is what makes rewriting history expensive — which is
            exactly what we&apos;ll attack on the next slide.
          </div>
        </Reveal>
      </div>
    </SlideShell>
  );
}
