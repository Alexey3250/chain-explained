"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";

/**
 * Flat, monospace per-slide layout: a `// kicker` line, a plain title, and a
 * body area. Pass `center` to vertically center the body (hero slides).
 */
export function SlideShell({
  kicker,
  title,
  lede,
  children,
  center = false,
  className = "",
}: {
  kicker?: ReactNode;
  title?: ReactNode;
  lede?: ReactNode;
  children?: ReactNode;
  center?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`mx-auto flex h-full w-full max-w-5xl flex-col px-6 pb-24 pt-14 sm:px-10 sm:pt-20 ${className}`}
    >
      {kicker && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.35 }}
          className="mb-2 font-mono text-xs tracking-wide text-accent"
        >
          {"// "}
          {kicker}
        </motion.div>
      )}
      {title && (
        <motion.h2
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.05 }}
          className="font-mono text-2xl font-bold leading-tight tracking-tight text-fg sm:text-3xl"
        >
          {title}
        </motion.h2>
      )}
      {lede && (
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="mt-3 max-w-2xl font-mono text-sm leading-relaxed text-muted sm:text-base"
        >
          {lede}
        </motion.p>
      )}
      <div
        className={`mt-7 flex min-h-0 flex-1 flex-col ${
          center ? "items-center justify-center text-center" : ""
        }`}
      >
        {children}
      </div>
    </div>
  );
}
