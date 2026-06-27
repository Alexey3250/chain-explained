"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";

/* A flat bordered surface — a terminal box. */
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
      className={`border bg-panel ${glow ? "border-accent/60" : "border-border"} ${className}`}
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
    <span className={`font-mono text-[0.92em] break-all ${toneClass} ${className}`}>
      {children}
    </span>
  );
}

/* Bracketed terminal-style label: [ label ] */
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
    default: "text-muted",
    accent: "text-accent",
    green: "text-green",
    red: "text-red",
    blue: "text-blue",
    purple: "text-purple",
  }[tone];
  return (
    <span
      className={`inline-flex items-center gap-1.5 font-mono text-xs ${map} ${className}`}
    >
      <span className="text-faint">[</span>
      {children}
      <span className="text-faint">]</span>
    </span>
  );
}

/* Flat bordered button; primary inverts on hover. */
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
    "inline-flex items-center justify-center gap-2 border px-3.5 py-2 font-mono text-sm transition disabled:opacity-40 disabled:cursor-not-allowed";
  const styles =
    variant === "primary"
      ? "border-accent text-accent hover:bg-accent hover:text-[#0b0c10]"
      : "border-border text-muted hover:border-fg hover:text-fg";
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

/* A labelled figure / stat — flat. */
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
    <div className="border border-border bg-panel px-4 py-3">
      <div className="text-[0.7rem] uppercase tracking-widest text-faint">
        {label}
      </div>
      <div className={`mt-1 font-mono text-lg font-semibold ${valTone}`}>
        {value}
      </div>
    </div>
  );
}

/* Fades children in, staggered by `delay`. */
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
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* An ASCII horizontal rule, optionally with a centered label. */
export function AsciiRule({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 font-mono text-xs text-faint">
      <span className="flex-1 truncate">────────────────────────────────────────</span>
      {label && <span className="shrink-0 text-muted">{label}</span>}
      <span className="flex-1 truncate">────────────────────────────────────────</span>
    </div>
  );
}
