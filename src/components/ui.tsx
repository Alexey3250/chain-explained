"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";

/* A bordered surface used to group content on a slide. */
export function Panel({
  children,
  className = "",
  glow = false,
}: {
  children: ReactNode;
  className?: string;
  glow?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border border-border bg-panel/70 backdrop-blur-sm ${
        glow ? "shadow-[0_0_40px_-12px_rgba(247,147,26,0.4)]" : ""
      } ${className}`}
    >
      {children}
    </div>
  );
}

/* Inline monospace chip for hashes, keys, hex, etc. */
export function Mono({
  children,
  className = "",
  tone = "default",
}: {
  children: ReactNode;
  className?: string;
  tone?: "default" | "accent" | "green" | "blue" | "muted";
}) {
  const toneClass = {
    default: "text-fg",
    accent: "text-accent",
    green: "text-green",
    blue: "text-blue",
    muted: "text-muted",
  }[tone];
  return (
    <span
      className={`font-mono text-[0.92em] break-all ${toneClass} ${className}`}
    >
      {children}
    </span>
  );
}

/* Small rounded label. */
export function Pill({
  children,
  tone = "default",
  className = "",
}: {
  children: ReactNode;
  tone?: "default" | "accent" | "green" | "red" | "blue" | "purple";
  className?: string;
}) {
  const map = {
    default: "border-border text-muted",
    accent: "border-accent/40 text-accent bg-accent/10",
    green: "border-green/40 text-green bg-green/10",
    red: "border-red/40 text-red bg-red/10",
    blue: "border-blue/40 text-blue bg-blue/10",
    purple: "border-purple/40 text-purple bg-purple/10",
  }[tone];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium tracking-wide ${map} ${className}`}
    >
      {children}
    </span>
  );
}

/* Primary / secondary button used inside slide demos. */
export function Btn({
  children,
  onClick,
  variant = "primary",
  disabled = false,
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "ghost";
  disabled?: boolean;
  className?: string;
}) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed";
  const styles =
    variant === "primary"
      ? "bg-accent text-[#1a1102] hover:bg-accent-soft"
      : "border border-border text-fg hover:bg-panel-2";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${styles} ${className}`}
    >
      {children}
    </button>
  );
}

/* A labelled figure / stat. */
export function Stat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  tone?: "default" | "accent" | "green";
}) {
  const valTone = {
    default: "text-fg",
    accent: "text-accent",
    green: "text-green",
  }[tone];
  return (
    <div className="rounded-xl border border-border bg-panel/60 px-4 py-3">
      <div className="text-[0.7rem] uppercase tracking-widest text-faint">
        {label}
      </div>
      <div className={`mt-1 font-mono text-lg font-semibold ${valTone}`}>
        {value}
      </div>
    </div>
  );
}

/* Fades + lifts children in, staggered by `delay`. */
export function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
