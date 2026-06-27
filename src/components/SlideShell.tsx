"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";

/**
 * Consistent per-slide layout: a small kicker line, a big title, and a body
 * area. Pass `center` to vertically center the body (used for hero slides).
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
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-accent"
        >
          {kicker}
        </motion.div>
      )}
      {title && (
        <motion.h2
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.05 }}
          className="text-balance text-3xl font-bold leading-tight tracking-tight sm:text-4xl"
        >
          {title}
        </motion.h2>
      )}
      {lede && (
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.12 }}
          className="mt-3 max-w-2xl text-pretty text-base text-muted sm:text-lg"
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
