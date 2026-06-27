"use client";

import { motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { SlideShell } from "@/components/SlideShell";
import { Btn, Mono, Panel, Pill } from "@/components/ui";
import { hex8, shaTrace, toBits, type ShaTrace } from "@/lib/sha256-rounds";

const LABELS = ["a", "b", "c", "d", "e", "f", "g", "h"];
const CHUNK_TONES = [
  "#f7931a", "#60a5fa", "#36d399", "#a78bfa",
  "#f87272", "#fbbf24", "#34d399", "#f472b6",
];

export default function Inside() {
  const [msg, setMsg] = useState("Bitcoin");
  const [showInside, setShowInside] = useState(false);

  const trace = useMemo(() => shaTrace(msg), [msg]);

  return (
    <SlideShell
      kicker="Foundation · The black box"
      title="The hash machine — just treat it as a box"
      lede="You saw what a hash does. This is the machine that makes it, running for real. The trick: you never have to understand the gears. Something goes in, a fingerprint comes out. That's it."
    >
      <label className="mb-4 flex items-center gap-2 text-xs text-faint">
        feed it anything
        <input
          value={msg}
          onChange={(e) => setMsg(e.target.value)}
          spellCheck={false}
          maxLength={55}
          className="w-48 rounded-lg border border-border bg-bg-soft px-3 py-1.5 font-mono text-sm text-fg outline-none focus:border-accent"
        />
      </label>

      <BlackBox trace={trace} msg={msg} />

      <button
        type="button"
        onClick={() => setShowInside((s) => !s)}
        className="mt-5 self-start text-sm text-muted underline decoration-dotted underline-offset-4 transition hover:text-accent"
      >
        {showInside
          ? "▴ Hide the gears"
          : "▾ Curious what those pixels mean? Peek inside the box"}
      </button>

      {showInside && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="mt-4"
        >
          <InsideWalkthrough trace={trace} msg={msg} />
        </motion.div>
      )}
    </SlideShell>
  );
}

/* ===================================================================== */
/*  The black box — pixelated animation (the main event)                 */
/* ===================================================================== */
function BlackBox({ trace, msg }: { trace: ShaTrace; msg: string }) {
  const [round, setRound] = useState(0);
  const [playing, setPlaying] = useState(true);

  // loop forever: churn 0→64, hold on the result, restart
  useEffect(() => {
    if (!playing) return;
    if (round >= 64) {
      const id = setTimeout(() => setRound(0), 1600);
      return () => clearTimeout(id);
    }
    const id = setTimeout(() => setRound((r) => r + 1), 75);
    return () => clearTimeout(id);
  }, [playing, round]);

  const idx = Math.min(round, 64);
  const cur = trace.states[idx];
  const prev = idx > 0 ? trace.states[idx - 1] : null;
  const bits = cur.flatMap((w) => toBits(w)); // 256 bits
  const prevBits = prev ? prev.flatMap((w) => toBits(w)) : null;
  const done = round >= 64;

  return (
    <div className="flex flex-col items-stretch gap-3 lg:flex-row lg:items-center lg:gap-4">
      {/* INPUT */}
      <Port label="input" tone="blue">
        <div className="font-mono text-sm text-blue break-all">
          &quot;{msg || " "}&quot;
        </div>
        <div className="mt-1 text-[0.65rem] text-faint">{trace.msgLen} bytes</div>
      </Port>

      <Arrow />

      {/* THE BOX */}
      <div
        className="relative mx-auto shrink-0 overflow-hidden rounded-lg border-2 border-accent/50 bg-[#08090d]"
        style={{
          boxShadow:
            "0 0 50px -10px rgba(247,147,26,0.45), inset 0 0 30px -12px rgba(247,147,26,0.4)",
        }}
      >
        {/* title bar */}
        <div className="flex items-center justify-between border-b border-accent/30 bg-accent/10 px-3 py-1.5">
          <span className="font-mono text-xs font-bold tracking-widest text-accent">
            SHA-256
          </span>
          <span className="flex items-center gap-1.5 font-mono text-[0.65rem] text-faint">
            <span
              className={`inline-block h-1.5 w-1.5 rounded-full ${
                done ? "bg-green" : "animate-pulse bg-accent"
              }`}
            />
            {done ? "done" : `${round.toString().padStart(2, "0")}/64`}
          </span>
        </div>

        {/* pixel grid */}
        <div className="relative p-3">
          <div
            className="grid gap-[2px]"
            style={{ gridTemplateColumns: "repeat(16, 1fr)" }}
          >
            {bits.map((bit, i) => {
              const changed = prevBits && prevBits[i] !== bit;
              return (
                <span
                  key={i}
                  className="h-2.5 w-2.5 transition-colors duration-150"
                  style={{
                    background: bit ? "var(--accent)" : "#15171f",
                    boxShadow: changed
                      ? "0 0 5px 1px rgba(247,147,26,0.9)"
                      : undefined,
                  }}
                />
              );
            })}
          </div>
          {/* scanline overlay for the retro feel */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage:
                "repeating-linear-gradient(0deg, rgba(0,0,0,0.28) 0px, rgba(0,0,0,0.28) 1px, transparent 1px, transparent 3px)",
            }}
          />
        </div>
      </div>

      <Arrow />

      {/* OUTPUT */}
      <Port label="output" tone={done ? "green" : "muted"}>
        {done ? (
          <motion.div
            initial={{ opacity: 0, filter: "blur(5px)" }}
            animate={{ opacity: 1, filter: "blur(0px)" }}
            transition={{ duration: 0.4 }}
            className="font-mono text-xs leading-relaxed text-green break-all"
          >
            {trace.digest}
          </motion.div>
        ) : (
          <div className="font-mono text-xs leading-relaxed text-faint blur-[1.5px] break-all">
            {cur.map((w) => hex8(w)).join("")}
          </div>
        )}
        <div className="mt-1 text-[0.65rem] text-faint">256-bit fingerprint</div>
      </Port>

      {/* tiny pause control, floated under the box on wide screens */}
      <button
        type="button"
        onClick={() => setPlaying((p) => !p)}
        className="self-center font-mono text-[0.7rem] text-faint underline decoration-dotted underline-offset-2 hover:text-accent lg:absolute lg:bottom-0 lg:left-1/2"
        aria-label={playing ? "Pause animation" : "Play animation"}
      >
        {playing ? "❚❚ pause" : "▶ play"}
      </button>
    </div>
  );
}

function Port({
  label,
  tone,
  children,
}: {
  label: string;
  tone: "blue" | "green" | "muted";
  children: React.ReactNode;
}) {
  const border =
    tone === "blue"
      ? "border-blue/30"
      : tone === "green"
        ? "border-green/40"
        : "border-border";
  return (
    <div
      className={`flex-1 rounded-lg border ${border} bg-panel/50 p-3 lg:max-w-[200px]`}
    >
      <div className="mb-1 text-[0.6rem] uppercase tracking-widest text-faint">
        {label}
      </div>
      {children}
    </div>
  );
}

function Arrow() {
  return (
    <div className="flex items-center justify-center">
      <motion.span
        animate={{ opacity: [0.3, 1, 0.3] }}
        transition={{ repeat: Infinity, duration: 1.4 }}
        className="rotate-90 text-xl text-accent lg:rotate-0"
      >
        →
      </motion.span>
    </div>
  );
}

/* ===================================================================== */
/*  Collapsible 4-stage walkthrough (for the curious)                    */
/* ===================================================================== */
const STAGES = [
  {
    key: "pad",
    tab: "1 · Pad",
    title: "Pack the message into a fixed box",
    caption:
      "SHA-256 only works on 512-bit (64-byte) blocks. We drop in your message, mark its end with a single 1, fill the rest with zeros, and write the length at the very end.",
  },
  {
    key: "schedule",
    tab: "2 · Schedule",
    title: "Stretch it into 64 words",
    caption:
      "The block is cut into 16 words, then mixed into 48 more — 64 total — so every round of stirring gets fresh material and your message spreads everywhere.",
  },
  {
    key: "mix",
    tab: "3 · Mix ×64",
    title: "Stir eight buckets, 64 times",
    caption:
      "Eight registers (a–h) get scrambled 64 times. Each round folds in one scheduled word + one constant. It's meant to look like random noise — that's diffusion doing its job.",
  },
  {
    key: "final",
    tab: "4 · Fingerprint",
    title: "Glue the buckets together",
    caption:
      "Add the stirred buckets back to the starting values and line them up. Those eight chunks, side by side, are your 256-bit fingerprint.",
  },
];

function InsideWalkthrough({ trace, msg }: { trace: ShaTrace; msg: string }) {
  const [stage, setStage] = useState(0);
  const [round, setRound] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(130);

  function goStage(i: number) {
    setStage(i);
    if (i === 2) {
      setRound(0);
      setPlaying(true);
    }
  }

  useEffect(() => {
    if (!playing || round >= 64) return;
    const id = setTimeout(() => setRound((r) => Math.min(64, r + 1)), speed);
    return () => clearTimeout(id);
  }, [playing, round, speed]);

  return (
    <Panel className="p-4">
      <div className="mb-3 flex flex-wrap gap-1.5">
        {STAGES.map((s, i) => (
          <button
            key={s.key}
            type="button"
            onClick={() => goStage(i)}
            className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
              i === stage
                ? "border-accent bg-accent/15 text-accent"
                : "border-border text-muted hover:bg-panel-2"
            }`}
          >
            {s.tab}
          </button>
        ))}
      </div>

      <div className="min-h-[230px]">
        {stage === 0 && <PadStage trace={trace} msg={msg} />}
        {stage === 1 && <ScheduleStage trace={trace} />}
        {stage === 2 && (
          <MixStage
            trace={trace}
            round={round}
            playing={playing}
            speed={speed}
            setPlaying={setPlaying}
            setSpeed={setSpeed}
            step={() => {
              setPlaying(false);
              setRound((r) => Math.min(64, r + 1));
            }}
            replay={() => {
              setRound(0);
              setPlaying(true);
            }}
          />
        )}
        {stage === 3 && <FinalStage trace={trace} />}
      </div>

      <div className="mt-3 rounded-xl border border-accent/25 bg-accent/5 p-3 text-sm text-pretty text-muted">
        <span className="font-semibold text-accent">{STAGES[stage].title}. </span>
        {STAGES[stage].caption}
      </div>

      <div className="mt-3 flex items-center justify-between">
        <Btn variant="ghost" onClick={() => goStage(Math.max(0, stage - 1))} disabled={stage === 0}>
          ◂ Back
        </Btn>
        <span className="font-mono text-xs text-faint">step {stage + 1} / 4</span>
        <Btn onClick={() => goStage(Math.min(3, stage + 1))} disabled={stage === 3}>
          Next ▸
        </Btn>
      </div>
    </Panel>
  );
}

/* ---------------- Stage 1: padding ---------------- */
function PadStage({ trace, msg }: { trace: ShaTrace; msg: string }) {
  const byteRole = (i: number) => {
    if (i < trace.msgLen) return "msg";
    if (i === trace.msgLen) return "one";
    if (i >= 56) return "len";
    return "zero";
  };
  const colors: Record<string, string> = {
    msg: "var(--blue)",
    one: "var(--accent)",
    len: "var(--green)",
    zero: "var(--panel-2)",
  };
  return (
    <div>
      <div className="mb-3 text-xs text-muted">
        <Mono tone="blue">&quot;{msg || " "}&quot;</Mono> = {trace.msgLen} bytes →
        padded to 64 bytes
      </div>
      <div className="grid grid-cols-8 gap-1 sm:gap-1.5" style={{ maxWidth: 460 }}>
        {trace.block.map((b, i) => {
          const role = byteRole(i);
          return (
            <div
              key={i}
              className="flex aspect-square items-center justify-center rounded-[4px] font-mono text-[0.6rem] sm:text-xs"
              style={{
                background: colors[role],
                color: role === "zero" ? "var(--faint)" : "#0b0c10",
                fontWeight: role === "zero" ? 400 : 700,
              }}
            >
              {b.toString(16).padStart(2, "0")}
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-3 text-xs">
        <Legend color="var(--blue)" label="your message" />
        <Legend color="var(--accent)" label="the “1” marker" />
        <Legend color="var(--panel-2)" label="zero padding" dim />
        <Legend color="var(--green)" label="length in bits" />
      </div>
    </div>
  );
}

/* ---------------- Stage 2: message schedule ---------------- */
function ScheduleStage({ trace }: { trace: ShaTrace }) {
  return (
    <div>
      <div className="mb-3 text-xs text-muted">
        16 words from your block → expanded to 64 words
      </div>
      <div className="grid grid-cols-8 gap-1 sm:gap-1.5" style={{ maxWidth: 500 }}>
        {trace.W.map((w, i) => {
          const fromMsg = i < 16;
          return (
            <motion.div
              key={i}
              initial={fromMsg ? false : { opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: fromMsg ? 0 : (i - 16) * 0.012, duration: 0.3 }}
              className="flex aspect-square items-center justify-center rounded-[4px] font-mono"
              style={{
                background: fromMsg ? "var(--blue)" : "var(--accent-dim)",
                border: fromMsg ? "none" : "1px solid var(--accent)",
                color: fromMsg ? "#0b0c10" : "var(--accent)",
              }}
              title={`W${i} = ${hex8(w)}`}
            >
              <span className="text-[0.55rem] opacity-70">w{i}</span>
            </motion.div>
          );
        })}
      </div>
      <p className="mt-3 font-mono text-[0.7rem] text-faint">
        each new word = σ₁(wₜ₋₂) + wₜ₋₇ + σ₀(wₜ₋₁₅) + wₜ₋₁₆
      </p>
    </div>
  );
}

/* ---------------- Stage 3: the mix ---------------- */
function MixStage({
  trace, round, playing, speed, setPlaying, setSpeed, step, replay,
}: {
  trace: ShaTrace;
  round: number;
  playing: boolean;
  speed: number;
  setPlaying: (f: (p: boolean) => boolean) => void;
  setSpeed: (n: number) => void;
  step: () => void;
  replay: () => void;
}) {
  const cur = trace.states[round];
  const prev = round > 0 ? trace.states[round - 1] : null;
  const done = round >= 64;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <Pill tone={done ? "green" : "accent"}>
          {done ? "✓ all 64 rounds done" : `round ${round} / 64`}
        </Pill>
        {!done && round > 0 && (
          <span className="font-mono text-xs text-faint">
            mixing in word <span className="text-accent">{hex8(trace.W[round - 1])}</span>
          </span>
        )}
      </div>
      <div className="overflow-x-auto scroll-thin">
        <div className="min-w-[500px] space-y-1">
          {LABELS.map((label, i) => {
            const bits = toBits(cur[i]);
            const pbits = prev ? toBits(prev[i]) : null;
            const fresh = (i === 0 || i === 4) && !done;
            return (
              <div key={label} className="flex items-center gap-2">
                <span className={`w-3 font-mono text-sm ${fresh ? "text-accent" : "text-faint"}`}>
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
                          background: bit ? "var(--accent)" : "var(--panel-2)",
                          boxShadow: changed ? "0 0 6px 1px rgba(247,147,26,0.8)" : undefined,
                        }}
                      />
                    );
                  })}
                </div>
                <Mono tone="muted" className="ml-1 hidden sm:inline">{hex8(cur[i])}</Mono>
              </div>
            );
          })}
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Btn onClick={() => (done ? replay() : setPlaying((p) => !p))}>
          {done ? "↻ Replay" : playing ? "⏸ Pause" : "▶ Play"}
        </Btn>
        <Btn variant="ghost" onClick={step} disabled={done}>Step ▸</Btn>
        <div className="ml-auto flex items-center gap-2 text-xs text-faint">
          slow
          <input
            type="range" min={30} max={400} value={430 - speed}
            onChange={(e) => setSpeed(430 - Number(e.target.value))}
            className="accent-[var(--accent)]"
          />
          fast
        </div>
      </div>
    </div>
  );
}

/* ---------------- Stage 4: final digest ---------------- */
function FinalStage({ trace }: { trace: ShaTrace }) {
  return (
    <div>
      <div className="mb-3 text-xs text-muted">
        8 final words → concatenated into 64 hex characters
      </div>
      <div className="flex flex-wrap gap-2">
        {trace.finalWords.map((w, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08, duration: 0.4 }}
            className="rounded-lg px-2.5 py-2 font-mono text-sm font-semibold"
            style={{
              background: `${CHUNK_TONES[i]}22`,
              border: `1px solid ${CHUNK_TONES[i]}`,
              color: CHUNK_TONES[i],
            }}
          >
            {hex8(w)}
          </motion.div>
        ))}
      </div>
      <div className="mt-4 rounded-xl border border-green/40 bg-green/10 p-4">
        <div className="text-[0.7rem] uppercase tracking-widest text-green">
          the SHA-256 fingerprint
        </div>
        <div className="mt-1 break-all font-mono text-sm text-green">{trace.digest}</div>
      </div>
    </div>
  );
}

/* ---------------- shared ---------------- */
function Legend({ color, label, dim = false }: { color: string; label: string; dim?: boolean }) {
  return (
    <span className="flex items-center gap-1.5 text-faint">
      <span className="h-3 w-3 rounded-[3px]" style={{ background: color, opacity: dim ? 0.7 : 1 }} />
      {label}
    </span>
  );
}
