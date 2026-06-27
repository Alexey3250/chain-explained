"use client";

import { motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { SlideShell } from "@/components/SlideShell";
import { Btn, Mono, Panel, Pill, Reveal } from "@/components/ui";
import { hex8, shaTrace, toBits } from "@/lib/sha256-rounds";

const LABELS = ["a", "b", "c", "d", "e", "f", "g", "h"];

export default function Inside() {
  const [msg, setMsg] = useState("Bitcoin");
  const [round, setRound] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(130); // ms per round

  const trace = useMemo(() => shaTrace(msg), [msg]);

  function changeMsg(value: string) {
    setMsg(value);
    setRound(0);
    setPlaying(true);
  }

  // drive the animation — simply stops scheduling once we hit the last round
  useEffect(() => {
    if (!playing || round >= 64) return;
    const id = setTimeout(() => setRound((r) => Math.min(64, r + 1)), speed);
    return () => clearTimeout(id);
  }, [playing, round, speed]);

  const cur = trace.states[round];
  const prev = round > 0 ? trace.states[round - 1] : null;
  const done = round >= 64;

  return (
    <SlideShell
      kicker="Foundation · Inside the hash"
      title="Watch a hash actually form"
      lede="The hash isn't magic — it's this machine. Eight 32-bit registers (a–h) get scrambled 64 times, mixing in one message word each round, until the bits settle into the fingerprint."
    >
      <div className="grid flex-1 items-start gap-6 lg:grid-cols-[1.45fr_0.55fr]">
        <Reveal>
          <Panel className="p-5" glow={done}>
            {/* round readout */}
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Pill tone={done ? "green" : "accent"}>
                  {done ? "✓ complete" : `round ${round} / 64`}
                </Pill>
                {!done && round > 0 && (
                  <span className="font-mono text-xs text-faint">
                    feeding Wₜ=<span className="text-accent">{hex8(trace.W[round - 1])}</span>{" "}
                    Kₜ=<span className="text-blue">{hex8(trace.K[round - 1])}</span>
                  </span>
                )}
              </div>
              <div className="font-mono text-xs text-faint">256 bits churning</div>
            </div>

            {/* the bit matrix */}
            <div className="overflow-x-auto scroll-thin">
              <div className="min-w-[520px] space-y-1">
                {LABELS.map((label, i) => {
                  const bits = toBits(cur[i]);
                  const pbits = prev ? toBits(prev[i]) : null;
                  const isNew = i === 0 || i === 4; // a and e are freshly computed
                  return (
                    <div key={label} className="flex items-center gap-2">
                      <span
                        className={`w-4 font-mono text-sm ${
                          isNew && !done ? "text-accent" : "text-faint"
                        }`}
                      >
                        {label}
                      </span>
                      <div className="flex gap-[2px]">
                        {bits.map((bit, j) => {
                          const changed = pbits && pbits[j] !== bit;
                          return (
                            <span
                              key={j}
                              className="h-3.5 w-3.5 rounded-[2px] transition-colors duration-200"
                              style={{
                                background: bit
                                  ? "var(--accent)"
                                  : "var(--panel-2)",
                                boxShadow: changed
                                  ? "0 0 6px 1px rgba(247,147,26,0.8)"
                                  : undefined,
                              }}
                            />
                          );
                        })}
                      </div>
                      <Mono tone="muted" className="ml-1 hidden sm:inline">
                        {hex8(cur[i])}
                      </Mono>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* digest */}
            <div className="mt-5 rounded-xl border border-border bg-bg-soft p-4">
              <div className="text-[0.7rem] uppercase tracking-widest text-faint">
                final 256-bit fingerprint
              </div>
              {done ? (
                <motion.div
                  initial={{ opacity: 0, filter: "blur(6px)" }}
                  animate={{ opacity: 1, filter: "blur(0px)" }}
                  transition={{ duration: 0.6 }}
                  className="mt-1 break-all font-mono text-sm text-green"
                >
                  {trace.digest}
                </motion.div>
              ) : (
                <div className="mt-1 break-all font-mono text-sm text-faint blur-[2px]">
                  {trace.digest}
                </div>
              )}
            </div>

            {/* controls */}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Btn onClick={() => (done ? restart() : setPlaying((p) => !p))}>
                {done ? "↻ Replay" : playing ? "⏸ Pause" : "▶ Play"}
              </Btn>
              <Btn
                variant="ghost"
                onClick={() => {
                  setPlaying(false);
                  setRound((r) => Math.min(64, r + 1));
                }}
                disabled={done}
              >
                Step ▸
              </Btn>
              <div className="ml-auto flex items-center gap-2 text-xs text-faint">
                slow
                <input
                  type="range"
                  min={30}
                  max={400}
                  value={430 - speed}
                  onChange={(e) => setSpeed(430 - Number(e.target.value))}
                  className="accent-[var(--accent)]"
                />
                fast
              </div>
            </div>
          </Panel>
        </Reveal>

        <Reveal delay={0.15} className="space-y-4">
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-widest text-faint">
              message in
            </span>
            <input
              value={msg}
              onChange={(e) => changeMsg(e.target.value)}
              spellCheck={false}
              maxLength={55}
              className="mt-2 w-full rounded-xl border border-border bg-bg-soft px-4 py-3 font-mono text-sm outline-none focus:border-accent"
            />
          </label>

          <div className="space-y-2.5 text-sm text-muted">
            <Flow t="Σ₁ + Ch" d="register e drives both — they mix e, f, g." />
            <Flow t="Σ₀ + Maj" d="register a drives both — they mix a, b, c." />
            <Flow t="+ Wₜ + Kₜ" d="one message word and one constant feed in." />
            <Flow t="shift" d="every register slides down; new a and e drop in (orange)." />
          </div>

          <div className="rounded-xl border border-accent/30 bg-accent/5 p-4 text-sm">
            That&apos;s your diagram, alive. After 64 rounds the bits are so
            thoroughly stirred that the output looks random — yet it&apos;s 100%
            repeatable. Change one letter above and watch a completely different
            pattern form.
          </div>
          {trace.truncated && (
            <p className="text-xs text-faint">
              (Showing the first block — messages here are capped at 55
              characters so the whole thing fits one pass.)
            </p>
          )}
        </Reveal>
      </div>
    </SlideShell>
  );

  function restart() {
    setRound(0);
    setPlaying(true);
  }
}

function Flow({ t, d }: { t: string; d: string }) {
  return (
    <div className="flex gap-2.5">
      <span className="mt-0.5 shrink-0 font-mono text-xs font-semibold text-accent">
        {t}
      </span>
      <span>{d}</span>
    </div>
  );
}
