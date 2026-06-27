"use client";

import { motion } from "motion/react";
import { memo, useEffect, useState } from "react";
import { Btn, Mono, Panel } from "@/components/ui";
import {
  add32,
  bigSig0,
  bigSig1,
  ch,
  hex8,
  maj,
  toBits,
  type ShaTrace,
} from "@/lib/sha256-rounds";

const LABELS = ["a", "b", "c", "d", "e", "f", "g", "h"];
const CHUNK_TONES = [
  "#f7931a", "#60a5fa", "#36d399", "#a78bfa",
  "#f87272", "#fbbf24", "#34d399", "#f472b6",
];
const TONE: Record<string, string> = {
  accent: "var(--accent)",
  blue: "var(--blue)",
  green: "var(--green)",
  grey: "#3a3f50",
};

/* ===================================================================== */
/*  The black box — pixelated animation                                  */
/* ===================================================================== */
export function BlackBox({ trace, msg }: { trace: ShaTrace; msg: string }) {
  const [round, setRound] = useState(0);
  const [playing, setPlaying] = useState(true);

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
  const bits = cur.flatMap((w) => toBits(w));
  const prevBits = prev ? prev.flatMap((w) => toBits(w)) : null;
  const done = round >= 64;

  return (
    <div className="flex w-full flex-col items-stretch gap-3 lg:flex-row lg:items-center lg:gap-4">
      <Port label="input" tone="blue">
        <div className="font-mono text-sm text-blue break-all">&quot;{msg || " "}&quot;</div>
        <div className="mt-1 text-[0.65rem] text-faint">{trace.msgLen} bytes</div>
      </Port>
      <Arrow />
      <div
        className="relative mx-auto shrink-0 overflow-hidden rounded-lg border-2 border-accent/50 bg-[#08090d]"
        style={{
          boxShadow:
            "0 0 50px -10px rgba(247,147,26,0.45), inset 0 0 30px -12px rgba(247,147,26,0.4)",
        }}
      >
        <div className="flex items-center justify-between border-b border-accent/30 bg-accent/10 px-3 py-1.5">
          <span className="font-mono text-xs font-bold tracking-widest text-accent">SHA-256</span>
          <span className="flex items-center gap-1.5 font-mono text-[0.65rem] text-faint">
            <span className={`inline-block h-1.5 w-1.5 rounded-full ${done ? "bg-green" : "animate-pulse bg-accent"}`} />
            {done ? "done" : `${round.toString().padStart(2, "0")}/64`}
          </span>
        </div>
        <div className="relative p-3">
          <div className="grid gap-[2px]" style={{ gridTemplateColumns: "repeat(16, 1fr)" }}>
            {bits.map((bit, i) => {
              const changed = prevBits && prevBits[i] !== bit;
              return (
                <span
                  key={i}
                  className="h-2.5 w-2.5 transition-colors duration-150"
                  style={{
                    background: bit ? "var(--accent)" : "#15171f",
                    boxShadow: changed ? "0 0 5px 1px rgba(247,147,26,0.9)" : undefined,
                  }}
                />
              );
            })}
          </div>
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
      <button
        type="button"
        onClick={() => setPlaying((p) => !p)}
        className="self-center font-mono text-[0.7rem] text-faint underline decoration-dotted underline-offset-2 hover:text-accent"
        aria-label={playing ? "Pause animation" : "Play animation"}
      >
        {playing ? "❚❚ pause" : "▶ play"}
      </button>
    </div>
  );
}

function Port({ label, tone, children }: { label: string; tone: "blue" | "green" | "muted"; children: React.ReactNode }) {
  const border = tone === "blue" ? "border-blue/30" : tone === "green" ? "border-green/40" : "border-border";
  return (
    <div className={`flex-1 rounded-lg border ${border} bg-panel/50 p-3 lg:max-w-[200px]`}>
      <div className="mb-1 text-[0.6rem] uppercase tracking-widest text-faint">{label}</div>
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
/*  The gears — full algorithm, stacked vertically as layers             */
/* ===================================================================== */
export function Gears({ trace, msg }: { trace: ShaTrace; msg: string }) {
  const [round, setRound] = useState(1);
  const [playing, setPlaying] = useState(true);

  useEffect(() => {
    if (!playing || round >= 64) return;
    const id = setTimeout(() => setRound((r) => Math.min(64, r + 1)), 600);
    return () => clearTimeout(id);
  }, [playing, round]);

  return (
    <Panel className="w-full p-4 text-left sm:p-6">
      <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-bg-soft p-3">
        <Btn onClick={() => setPlaying((p) => !p)} className="!py-2">
          {playing ? "⏸" : "▶"}
        </Btn>
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm text-accent">round {round}</span>
          <span className="font-mono text-xs text-faint">/ 64</span>
        </div>
        <input
          type="range"
          min={1}
          max={64}
          value={round}
          onChange={(e) => {
            setPlaying(false);
            setRound(Number(e.target.value));
          }}
          className="flex-1 accent-[var(--accent)]"
        />
      </div>

      <p className="mb-5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-faint">
        <span>Each little square is one bit:</span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2.5 w-2.5" style={{ background: "var(--accent)" }} /> = 1
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2.5 w-2.5" style={{ background: "#15171f" }} /> = 0
        </span>
        <span>· 32 squares = one 32-bit number.</span>
      </p>

      <div className="space-y-8">
        <Layer n="01" title="Input" desc="Your message, as raw bytes.">
          <InputLayer trace={trace} msg={msg} />
        </Layer>
        <Layer n="02" title="Padding" desc="Pad to a 512-bit block: the message, a single 1 bit, zeros, then the length.">
          <PaddingLayer trace={trace} />
        </Layer>
        <Layer n="03" title="Message schedule" desc="The 16 block words are stretched into 64. The highlighted row is the word feeding this round.">
          <ScheduleLayer trace={trace} current={round - 1} />
        </Layer>
        <Layer n="04" title="Compression" desc="Eight registers (a–h) are mixed 64 times. Here's exactly what this round does.">
          <CompressionLayer trace={trace} round={round} />
        </Layer>
        <Layer n="05" title="Output" desc="Add the registers back to the start values, glue them together.">
          <OutputLayer trace={trace} />
        </Layer>
      </div>
    </Panel>
  );
}

function Layer({ n, title, desc, children }: { n: string; title: string; desc: string; children: React.ReactNode }) {
  return (
    <section className="border-l-2 border-accent/30 pl-4">
      <div className="flex items-baseline gap-2">
        <span className="font-mono text-sm font-bold text-accent">{n}</span>
        <h3 className="text-lg font-semibold">{title}</h3>
      </div>
      <p className="mb-3 mt-0.5 max-w-2xl text-xs text-muted">{desc}</p>
      <div className="overflow-x-auto scroll-thin">{children}</div>
    </section>
  );
}

function BitRow({
  word, tone = "accent", prev = null, size = "md",
}: {
  word: number;
  tone?: keyof typeof TONE;
  prev?: number | null;
  size?: "sm" | "md";
}) {
  const bits = toBits(word);
  const pb = prev != null ? toBits(prev) : null;
  const cls = size === "sm" ? "h-2 w-2" : "h-3 w-3";
  return (
    <div className="flex gap-[2px]">
      {bits.map((b, i) => {
        const changed = pb && pb[i] !== b;
        return (
          <span
            key={i}
            className={cls}
            style={{
              background: b ? TONE[tone] : "#15171f",
              boxShadow: changed ? "0 0 5px 1px rgba(247,147,26,0.85)" : undefined,
            }}
          />
        );
      })}
    </div>
  );
}

function InputLayer({ trace, msg }: { trace: ShaTrace; msg: string }) {
  const bytes = trace.block.slice(0, trace.msgLen);
  return (
    <div className="space-y-2">
      <div className="font-mono text-sm">
        <span className="text-faint">text: </span>
        <span className="text-blue">&quot;{msg || " "}&quot;</span>
        <span className="ml-2 text-faint">({trace.msgLen} bytes)</span>
      </div>
      <div className="flex flex-wrap gap-1">
        {bytes.length === 0 && <span className="text-xs text-faint">(empty)</span>}
        {bytes.map((b, i) => (
          <span key={i} className="rounded bg-blue/15 px-1.5 py-0.5 font-mono text-xs text-blue" title={`'${msg[i] ?? ""}'`}>
            {b.toString(16).padStart(2, "0")}
          </span>
        ))}
      </div>
    </div>
  );
}

function PaddingLayer({ trace }: { trace: ShaTrace }) {
  const roleColor = (i: number) => {
    if (i < trace.msgLen) return "blue";
    if (i === trace.msgLen) return "accent";
    if (i >= 56) return "green";
    return "grey";
  };
  return (
    <div className="space-y-1.5">
      <div className="space-y-[2px]">
        {Array.from({ length: 16 }).map((_, r) => {
          const bits = toBits(trace.W[r]);
          return (
            <div key={r} className="flex gap-[2px]">
              {bits.map((bit, p) => {
                const byte = Math.floor((r * 32 + p) / 8);
                const color = TONE[roleColor(byte)];
                return <span key={p} className="h-2 w-2" style={{ background: bit ? color : `${color}22` }} />;
              })}
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-3 pt-1 text-xs">
        <Legend color={TONE.blue} label="message" />
        <Legend color={TONE.accent} label="the “1” marker" />
        <Legend color={TONE.grey} label="zero padding" />
        <Legend color={TONE.green} label="length" />
      </div>
    </div>
  );
}

const ScheduleRow = memo(function ScheduleRow({
  word, index, fromMsg, active,
}: {
  word: number;
  index: number;
  fromMsg: boolean;
  active: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-2 rounded px-1 ${active ? "bg-accent/15 ring-1 ring-accent" : ""}`}
      title={`W${index} = ${hex8(word)}`}
    >
      <span className="w-7 shrink-0 text-right font-mono text-[0.6rem] text-faint">w{index}</span>
      <BitRow word={word} tone={fromMsg ? "blue" : "accent"} size="sm" />
      <Mono tone="muted" className="ml-1 hidden text-[0.65rem] sm:inline">{hex8(word)}</Mono>
    </div>
  );
});

function ScheduleLayer({ trace, current }: { trace: ShaTrace; current: number }) {
  return (
    <div className="space-y-[3px]">
      <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.6rem] text-faint">
        <span className="inline-flex items-center gap-1">
          <span className="h-2.5 w-2.5" style={{ background: TONE.blue }} /> from your message (w0–w15)
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2.5 w-2.5" style={{ background: TONE.accent }} /> computed from earlier words (w16–w63)
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2.5 w-2.5 ring-1 ring-accent" /> this round&apos;s word
        </span>
      </div>
      {trace.W.map((w, i) => (
        <ScheduleRow key={i} word={w} index={i} fromMsg={i < 16} active={i === current} />
      ))}
      <p className="pt-2 font-mono text-[0.7rem] text-faint">
        wₜ = σ₁(wₜ₋₂) + wₜ₋₇ + σ₀(wₜ₋₁₅) + wₜ₋₁₆
      </p>
    </div>
  );
}

function CompressionLayer({ trace, round }: { trace: ShaTrace; round: number }) {
  const t = round - 1;
  const prev = trace.states[round - 1];
  const cur = trace.states[round];
  const [a, b, c, , e, f, g, h] = prev;

  const s1 = bigSig1(e);
  const chv = ch(e, f, g);
  const t1 = add32(h, s1, chv, trace.K[t], trace.W[t]);
  const s0 = bigSig0(a);
  const mj = maj(a, b, c);
  const t2 = add32(s0, mj);

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <div className="space-y-1.5 font-mono text-xs">
        <MathRow label="Σ₁(e)" val={s1} tone="green" />
        <MathRow label="Ch(e,f,g)" val={chv} tone="green" />
        <MathRow label="+ Kₜ" val={trace.K[t]} tone="blue" />
        <MathRow label="+ Wₜ" val={trace.W[t]} tone="accent" />
        <MathRow label="= T1" val={t1} tone="accent" strong />
        <div className="h-1" />
        <MathRow label="Σ₀(a)" val={s0} tone="green" />
        <MathRow label="Maj(a,b,c)" val={mj} tone="green" />
        <MathRow label="= T2" val={t2} tone="accent" strong />
      </div>

      <div className="space-y-1">
        <div className="mb-1.5 text-[0.65rem] uppercase tracking-widest text-faint">
          registers after round {round}
        </div>
        <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.6rem] text-faint">
          <span className="inline-flex items-center gap-1">
            <span className="h-2.5 w-2.5" style={{ background: "var(--accent)", boxShadow: "0 0 5px 1px rgba(247,147,26,0.85)" }} />
            a glowing square = a bit that just flipped
          </span>
        </div>
        {LABELS.map((label, i) => {
          const fresh = i === 0 || i === 4;
          return (
            <div key={label} className="flex items-center gap-2">
              <span className={`w-3 font-mono text-xs ${fresh ? "text-accent" : "text-faint"}`}>{label}</span>
              <BitRow word={cur[i]} tone="accent" prev={prev[i]} size="sm" />
              <Mono tone="muted" className="ml-1 hidden text-[0.65rem] sm:inline">{hex8(cur[i])}</Mono>
              {fresh && <span className="text-[0.55rem] font-semibold text-accent">← recomputed</span>}
            </div>
          );
        })}
        <p className="pt-1.5 text-[0.65rem] text-muted">
          Only <span className="font-mono text-accent">a</span> and{" "}
          <span className="font-mono text-accent">e</span> are freshly built each round (a = T1+T2, e = d+T1).
          The other six just shift down one slot.
        </p>
      </div>
    </div>
  );
}

function MathRow({ label, val, tone, strong = false }: { label: string; val: number; tone: keyof typeof TONE; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className={`text-faint ${strong ? "font-bold text-fg" : ""}`}>{label}</span>
      <span style={{ color: TONE[tone] }} className={strong ? "font-bold" : ""}>{hex8(val)}</span>
    </div>
  );
}

function OutputLayer({ trace }: { trace: ShaTrace }) {
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {trace.finalWords.map((w, i) => (
          <div
            key={i}
            className="rounded-lg px-2.5 py-2 font-mono text-sm font-semibold"
            style={{ background: `${CHUNK_TONES[i]}22`, border: `1px solid ${CHUNK_TONES[i]}`, color: CHUNK_TONES[i] }}
          >
            {hex8(w)}
          </div>
        ))}
      </div>
      <div className="mt-4 rounded-xl border border-green/40 bg-green/10 p-4">
        <div className="text-[0.7rem] uppercase tracking-widest text-green">the SHA-256 fingerprint</div>
        <div className="mt-1 break-all font-mono text-sm text-green">{trace.digest}</div>
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-faint">
      <span className="h-3 w-3 rounded-[3px]" style={{ background: color }} />
      {label}
    </span>
  );
}
