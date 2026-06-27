"use client";

import { motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { SlideShell } from "@/components/SlideShell";
import { Btn, Mono, Panel, Pill } from "@/components/ui";
import { hex8, shaTrace, toBits, type ShaTrace } from "@/lib/sha256-rounds";

const LABELS = ["a", "b", "c", "d", "e", "f", "g", "h"];
const CHUNK_TONES = [
  "#f7931a",
  "#60a5fa",
  "#36d399",
  "#a78bfa",
  "#f87272",
  "#fbbf24",
  "#34d399",
  "#f472b6",
];

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
      "The block is cut into 16 words. We then mix those into 48 more — 64 total — so every round of stirring gets fresh material and your message spreads everywhere.",
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

export default function Inside() {
  const [msg, setMsg] = useState("Bitcoin");
  const [stage, setStage] = useState(0);
  const [round, setRound] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(130);

  const trace = useMemo(() => shaTrace(msg), [msg]);

  function changeMsg(value: string) {
    setMsg(value);
    setRound(0);
    if (stage === 2) setPlaying(true);
  }

  function goStage(i: number) {
    setStage(i);
    if (i === 2) {
      setRound(0);
      setPlaying(true);
    }
  }

  // round driver (only matters on the Mix stage)
  useEffect(() => {
    if (!playing || round >= 64) return;
    const id = setTimeout(() => setRound((r) => Math.min(64, r + 1)), speed);
    return () => clearTimeout(id);
  }, [playing, round, speed]);

  return (
    <SlideShell
      kicker="Foundation · Inside the hash"
      title="How a hash is actually made"
      lede="A hash isn't magic — it's four plain steps. Walk through them and the “random” fingerprint stops looking random."
    >
      {/* stepper + message input */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
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
        <label className="flex items-center gap-2 text-xs text-faint">
          message
          <input
            value={msg}
            onChange={(e) => changeMsg(e.target.value)}
            spellCheck={false}
            maxLength={55}
            className="w-44 rounded-lg border border-border bg-bg-soft px-3 py-1.5 font-mono text-sm text-fg outline-none focus:border-accent"
          />
        </label>
      </div>

      <Panel className="flex min-h-[300px] flex-1 flex-col p-5" glow={stage === 3}>
        <div className="flex-1">
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

        {/* caption */}
        <div className="mt-4 rounded-xl border border-accent/25 bg-accent/5 p-3.5 text-sm text-pretty text-muted">
          <span className="font-semibold text-accent">
            {STAGES[stage].title}.{" "}
          </span>
          {STAGES[stage].caption}
        </div>
      </Panel>

      {/* nav */}
      <div className="mt-3 flex items-center justify-between">
        <Btn
          variant="ghost"
          onClick={() => goStage(Math.max(0, stage - 1))}
          disabled={stage === 0}
        >
          ◂ Back
        </Btn>
        <span className="font-mono text-xs text-faint">
          step {stage + 1} / 4
        </span>
        <Btn
          onClick={() => goStage(Math.min(3, stage + 1))}
          disabled={stage === 3}
        >
          Next ▸
        </Btn>
      </div>
    </SlideShell>
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
      <div className="mb-3 flex flex-wrap items-center gap-3 text-xs text-muted">
        <span>
          <Mono tone="blue">&quot;{msg || " "}&quot;</Mono> = {trace.msgLen}{" "}
          bytes → padded to 64 bytes
        </span>
      </div>
      <div className="grid grid-cols-8 gap-1 sm:gap-1.5" style={{ maxWidth: 480 }}>
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
        <Legend color="var(--accent)" label="the “1” marker (0x80)" />
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
      <div className="grid grid-cols-8 gap-1 sm:gap-1.5" style={{ maxWidth: 520 }}>
        {trace.W.map((w, i) => {
          const fromMsg = i < 16;
          return (
            <motion.div
              key={i}
              initial={fromMsg ? false : { opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: fromMsg ? 0 : (i - 16) * 0.012, duration: 0.3 }}
              className="flex aspect-square flex-col items-center justify-center rounded-[4px] font-mono"
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
      <div className="mt-3 flex flex-wrap gap-3 text-xs">
        <Legend color="var(--blue)" label="straight from your message (w0–w15)" />
        <Legend color="var(--accent)" label="mixed from earlier words (w16–w63)" />
      </div>
      <p className="mt-2 font-mono text-[0.7rem] text-faint">
        each new word = σ₁(wₜ₋₂) + wₜ₋₇ + σ₀(wₜ₋₁₅) + wₜ₋₁₆
      </p>
    </div>
  );
}

/* ---------------- Stage 3: the mix ---------------- */
function MixStage({
  trace,
  round,
  playing,
  speed,
  setPlaying,
  setSpeed,
  step,
  replay,
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

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Btn onClick={() => (done ? replay() : setPlaying((p) => !p))}>
          {done ? "↻ Replay" : playing ? "⏸ Pause" : "▶ Play"}
        </Btn>
        <Btn variant="ghost" onClick={step} disabled={done}>
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

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7 }}
        className="mt-5 rounded-xl border border-green/40 bg-green/10 p-4"
      >
        <div className="text-[0.7rem] uppercase tracking-widest text-green">
          the SHA-256 fingerprint
        </div>
        <div className="mt-1 break-all font-mono text-sm text-green">
          {trace.digest}
        </div>
      </motion.div>
      <p className="mt-3 text-xs text-faint">
        Change one letter of the message and every chunk changes completely —
        the avalanche effect, now you&apos;ve seen exactly where it comes from.
      </p>
    </div>
  );
}

/* ---------------- shared ---------------- */
function Legend({
  color,
  label,
  dim = false,
}: {
  color: string;
  label: string;
  dim?: boolean;
}) {
  return (
    <span className="flex items-center gap-1.5 text-faint">
      <span
        className="h-3 w-3 rounded-[3px]"
        style={{ background: color, opacity: dim ? 0.7 : 1 }}
      />
      {label}
    </span>
  );
}
