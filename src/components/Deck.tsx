"use client";

import { AnimatePresence, motion } from "motion/react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { slides } from "@/slides";

const variants = {
  enter: (dir: number) => ({ opacity: 0, x: dir >= 0 ? 48 : -48 }),
  center: { opacity: 1, x: 0 },
  exit: (dir: number) => ({ opacity: 0, x: dir >= 0 ? -48 : 48 }),
};

function indexFromHash(): number {
  if (typeof window === "undefined") return 0;
  const raw = window.location.hash.replace(/^#/, "");
  if (!raw) return 0;
  const byId = slides.findIndex((s) => s.id === raw);
  if (byId >= 0) return byId;
  const n = parseInt(raw, 10);
  if (!Number.isNaN(n) && n >= 1 && n <= slides.length) return n - 1;
  return 0;
}

export default function Deck() {
  const [[index, dir], setState] = useState<[number, number]>([0, 0]);
  const [ready, setReady] = useState(false);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const goTo = useCallback((target: number, direction?: number) => {
    setState(([cur]) => {
      const clamped = Math.max(0, Math.min(slides.length - 1, target));
      return [clamped, direction ?? (clamped >= cur ? 1 : -1)];
    });
  }, []);

  const next = useCallback(
    () => setState(([cur]) => [Math.min(slides.length - 1, cur + 1), 1]),
    [],
  );
  const prev = useCallback(
    () => setState(([cur]) => [Math.max(0, cur - 1), -1]),
    [],
  );

  // reflect the current slide in the URL hash + start each slide at the top
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
    if (typeof window === "undefined") return;
    const id = slides[index].id;
    if (window.location.hash.replace(/^#/, "") !== id) {
      history.replaceState(null, "", `#${id}`);
    }
  }, [index]);

  // sync with the URL hash on mount + on back/forward (external system)
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    goTo(indexFromHash(), 0);
    setReady(true);
    const onHash = () => goTo(indexFromHash(), 0);
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [goTo]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // keyboard navigation
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const typing = tag === "INPUT" || tag === "TEXTAREA";
      if (e.key === "ArrowRight" || (e.key === " " && !typing)) {
        e.preventDefault();
        next();
      } else if (e.key === "ArrowLeft") {
        prev();
      } else if (e.key === "Home") {
        goTo(0, -1);
      } else if (e.key === "End") {
        goTo(slides.length - 1, 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev, goTo]);

  // lightweight swipe (ignores gestures starting on interactive elements)
  const onPointerDown = (e: ReactPointerEvent) => {
    if (e.pointerType === "mouse") return;
    const t = e.target as HTMLElement;
    if (t.closest("input, textarea, button, a, [data-no-swipe]")) return;
    touch.current = { x: e.clientX, y: e.clientY };
  };
  const onPointerUp = (e: ReactPointerEvent) => {
    if (!touch.current) return;
    const dx = e.clientX - touch.current.x;
    const dy = e.clientY - touch.current.y;
    touch.current = null;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      if (dx < 0) next();
      else prev();
    }
  };

  const current = slides[index];
  const Slide = current.Component;
  const progress = (index + 1) / slides.length;

  return (
    <main
      className="relative h-full w-full overflow-hidden"
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
    >
      {/* top progress bar */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-30 h-0.5 bg-border/60">
        <motion.div
          className="h-full bg-accent"
          animate={{ width: `${progress * 100}%` }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        />
      </div>

      {/* brand */}
      <div className="absolute left-5 top-4 z-30 flex items-center gap-1 font-mono text-sm sm:left-8">
        <span className="text-faint">~/</span>
        <span className="text-fg">chain-explained</span>
        <span className="text-accent blink">█</span>
      </div>

      {/* chapter + counter */}
      <div className="absolute right-5 top-4 z-30 flex items-center gap-3 font-mono text-xs sm:right-8">
        <span className="hidden text-muted sm:inline">
          {"// "}
          {current.chapter.toLowerCase()}
        </span>
        <span className="text-faint">
          [{String(index + 1).padStart(2, "0")}/{slides.length}]
        </span>
      </div>

      {/* slide body */}
      <div ref={scrollRef} className="scroll-thin h-full w-full overflow-y-auto">
        <AnimatePresence mode="wait" custom={dir} initial={false}>
          <motion.div
            key={current.id}
            custom={dir}
            variants={variants}
            initial={ready ? "enter" : false}
            animate="center"
            exit="exit"
            transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
            className="min-h-full"
          >
            <Slide />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* bottom nav — flat terminal bar */}
      <div className="absolute inset-x-0 bottom-0 z-30 flex items-center justify-center gap-3 border-t border-border bg-bg py-2.5 font-mono text-sm">
        <button
          type="button"
          onClick={prev}
          disabled={index === 0}
          aria-label="Previous slide"
          className="border border-border px-2.5 py-1 text-muted transition hover:border-fg hover:text-fg disabled:opacity-30"
        >
          [ prev ]
        </button>

        <div className="flex max-w-[45vw] items-center gap-1 overflow-hidden text-faint">
          {slides.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={() => goTo(i)}
              aria-label={`Go to: ${s.title}`}
              title={s.title}
              className={`px-0.5 leading-none transition ${
                i === index ? "text-accent" : "text-faint hover:text-muted"
              }`}
            >
              {i === index ? "█" : "·"}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={next}
          disabled={index === slides.length - 1}
          aria-label="Next slide"
          className="border border-accent px-2.5 py-1 text-accent transition hover:bg-accent hover:text-bg disabled:opacity-30"
        >
          [ next ]
        </button>
      </div>

      {/* keyboard hint */}
      <div className="pointer-events-none absolute bottom-3 right-6 z-30 hidden font-mono text-xs text-faint lg:block">
        ← / → to navigate
      </div>
    </main>
  );
}
