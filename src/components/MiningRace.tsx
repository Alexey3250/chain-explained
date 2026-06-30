"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { feeToColor } from "@/lib/fee";
import { sha256Short } from "@/lib/sha256-rounds";

/* =====================================================================
   Proof-of-work, for real. A few miners each build a block header
   (previous-block hash + transactions + a nonce) and hash it with
   SHA-256 over and over, changing the nonce, racing to find a hash that
   starts with TARGET zeros. The first one to hit it wins — its block
   links onto the chain and everyone starts again on top of it.
   ===================================================================== */

const TARGET = 4; // a valid hash must start with this many hex zeros
const TICK = 70; // ms per render tick
const CHAIN_MAX = 7;
const WIN_HOLD = 1500; // ms to show the winner before the chain advances

type Region = "chain" | "prevhash" | "txs" | "nonce" | "hash" | "target" | "miner" | "mempool";

const MAP: Record<Region, { title: string; body: string }> = {
  mempool: {
    title: "the mempool",
    body: "Unconfirmed transactions waiting to be included. Each miner pulls a batch of them into the block it's trying to mine.",
  },
  txs: {
    title: "the transactions",
    body: "The payments packed into this candidate block, summarised by a single 'merkle root' hash. Changing any transaction changes that root — and therefore the block's hash.",
  },
  prevhash: {
    title: "previous block hash",
    body: "Every block commits to the hash of the block before it. This is the link that chains blocks together: rewrite an old block and every hash after it breaks.",
  },
  nonce: {
    title: "the nonce",
    body: "The one field a miner is free to change. It just keeps incrementing it — billions of times — because that's the only way to get a different hash out.",
  },
  hash: {
    title: "the block hash",
    body: "SHA-256 of the whole header. It's unpredictable: nudging the nonce by 1 scrambles it completely. A block is only valid if this hash starts with enough zeros.",
  },
  target: {
    title: "the target (difficulty)",
    body: "How many leading zeros the hash must have. More zeros = exponentially rarer = harder. The network retunes it so a block is found about every ten minutes.",
  },
  miner: {
    title: "a miner",
    body: "One of thousands of competitors, all hashing as fast as they can. Whoever finds a valid hash first wins the block reward and gets to extend the chain.",
  },
  chain: {
    title: "the blockchain",
    body: "The winning blocks, each linked to the last by its hash. The newest sits on the right; the oldest scrolls off into deep history.",
  },
};

const REGION_ORDER: Region[] = ["mempool", "txs", "prevhash", "nonce", "hash", "target", "miner", "chain"];

const MINER_NAMES = ["asia-1", "eu-2", "us-3", "lat-4"];
const randHex = (n: number) =>
  Array.from({ length: n }, () => "0123456789abcdef"[(Math.random() * 16) | 0]).join("");
const leadingZeros = (h: string) => {
  let z = 0;
  while (z < h.length && h[z] === "0") z++;
  return z;
};

type MinerView = { id: number; name: string; nonce: number; hash: string; zeros: number; won: boolean };
type Block = { hash: string; miner: string; fees: number[] };

export default function MiningRace({ mode }: { mode: "intro" | "outro" }) {
  const intro = mode === "intro";
  const nMiners = intro ? 2 : 3;
  const perTick = intro ? 320 : 430; // hashes per miner per tick (race pace)

  const [hovered, setHovered] = useState<Region | null>(null);
  const [tour, setTour] = useState<Region | null>(intro ? null : "mempool");
  const [reduced, setReduced] = useState(false);

  const seedHash = () => "0000" + randHex(60);
  const [prevHash, setPrevHash] = useState(() => seedHash());
  const [miners, setMiners] = useState<MinerView[]>(() =>
    Array.from({ length: nMiners }, (_, i) => ({ id: i, name: MINER_NAMES[i], nonce: 0, hash: randHex(64), zeros: 0, won: false })),
  );
  const [chain, setChain] = useState<Block[]>(() =>
    Array.from({ length: 5 }, () => ({ hash: seedHash(), miner: MINER_NAMES[0], fees: Array.from({ length: 9 }, () => Math.random() ** 2 * 60 + 1) })),
  );
  const [mem, setMem] = useState<number[]>(() => Array.from({ length: 90 }, () => Math.random() ** 2 * 80 + 1));
  const [txCount, setTxCount] = useState(intro ? 9 : 14);
  const [winner, setWinner] = useState<string | null>(null);

  const wrapRef = useRef<HTMLDivElement>(null);
  const visibleRef = useRef(true);

  // live mining state (refs, not re-render)
  const sim = useRef({
    prev: prevHash,
    nonces: new Array(nMiners).fill(0),
    speeds: new Array<number>(nMiners).fill(1),
    phase: "race" as "race" | "won",
    wonAt: 0,
    winId: -1,
    winHash: "",
    txc: txCount,
  });

  useEffect(() => {
    const m = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setReduced(m.matches);
    on();
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const io = new IntersectionObserver((e) => (visibleRef.current = e[0].isIntersecting), { threshold: 0.05 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (intro || reduced) return;
    let i = 0;
    const id = setInterval(() => {
      i = (i + 1) % REGION_ORDER.length;
      setTour(REGION_ORDER[i]);
    }, 4500);
    return () => clearInterval(id);
  }, [intro, reduced]);

  // the mining loop
  useEffect(() => {
    if (reduced) return;
    const s = sim.current;
    s.speeds = Array.from({ length: nMiners }, () => 0.7 + Math.random() * 0.6);
    let t = 0;
    const id = setInterval(() => {
      if (!visibleRef.current) return;

      if (s.phase === "race") {
        const views: MinerView[] = [];
        let foundId = -1;
        let foundHash = "";
        for (let i = 0; i < nMiners; i++) {
          const budget = Math.round(perTick * s.speeds[i]);
          let last = "";
          let lastZ = 0;
          for (let k = 0; k < budget; k++) {
            s.nonces[i]++;
            last = sha256Short(s.prev.slice(0, 12) + i + s.nonces[i]);
            lastZ = leadingZeros(last);
            if (lastZ >= TARGET) {
              foundId = i;
              foundHash = last;
              break;
            }
          }
          views.push({ id: i, name: MINER_NAMES[i], nonce: s.nonces[i], hash: last || randHex(64), zeros: lastZ, won: false });
          if (foundId >= 0) break;
        }
        if (foundId >= 0) {
          // fill the rest of views for non-iterated miners (keep their last)
          for (let i = views.length; i < nMiners; i++) views.push({ id: i, name: MINER_NAMES[i], nonce: s.nonces[i], hash: randHex(64), zeros: 0, won: false });
          views.forEach((v) => (v.won = v.id === foundId));
          s.phase = "won";
          s.wonAt = t * TICK;
          s.winId = foundId;
          s.winHash = foundHash;
          setMiners(views.map((v) => (v.id === foundId ? { ...v, hash: foundHash, zeros: leadingZeros(foundHash) } : v)));
          setWinner(MINER_NAMES[foundId]);
        } else {
          setMiners(views);
          // mempool drifts up a little
          if (t % 3 === 0) setMem((m) => (m.length < 140 ? [...m, Math.random() ** 2 * 80 + 1] : m));
        }
      } else if (s.phase === "won") {
        if (t * TICK - s.wonAt >= WIN_HOLD) {
          // add the block, advance the chain, restart on top of it
          const fees = Array.from({ length: 9 }, () => Math.random() ** 2 * 60 + 1);
          setChain((c) => [{ hash: s.winHash, miner: MINER_NAMES[s.winId], fees }, ...c].slice(0, CHAIN_MAX));
          setPrevHash(s.winHash);
          s.prev = s.winHash;
          // consume txs from the mempool
          setMem((m) => m.slice(0, Math.max(0, m.length - s.txc)));
          setTxCount(intro ? 8 + ((Math.random() * 6) | 0) : 11 + ((Math.random() * 9) | 0));
          s.txc = intro ? 8 + ((Math.random() * 6) | 0) : 11 + ((Math.random() * 9) | 0);
          // reset miners
          s.nonces = new Array(nMiners).fill(0);
          s.speeds = Array.from({ length: nMiners }, () => 0.7 + Math.random() * 0.6);
          s.phase = "race";
          s.winId = -1;
          setWinner(null);
          setMiners(Array.from({ length: nMiners }, (_, i) => ({ id: i, name: MINER_NAMES[i], nonce: 0, hash: randHex(64), zeros: 0, won: false })));
        }
      }
      t++;
    }, TICK);
    return () => clearInterval(id);
  }, [reduced, intro, nMiners, perTick]);

  const eff: Region | null = hovered ?? (intro ? null : tour);
  const info = eff ? MAP[eff] : null;

  const hoverProps = (r: Region) => ({
    tabIndex: 0,
    role: "button" as const,
    "aria-label": MAP[r].title,
    onMouseEnter: () => setHovered(r),
    onMouseLeave: () => setHovered(null),
    onFocus: () => setHovered(r),
    onBlur: () => setHovered(null),
    onClick: () => setHovered(r),
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        setHovered(r);
      }
    },
    className: `cursor-pointer outline-none transition-colors ${eff === r ? "bg-accent/10" : ""}`,
  });

  return (
    <div ref={wrapRef} className="w-full font-mono" data-no-swipe>
      <div className="border border-border bg-bg p-3">
        {/* ---- the chain ---- */}
        <div className="mb-1 flex items-center justify-between text-[0.6rem] text-faint">
          <span>──── the blockchain ── newest →</span>
          <span className="text-muted">target: {"0".repeat(TARGET)}… ({TARGET} zeros)</span>
        </div>
        <div
          {...hoverProps("chain")}
          className={`flex items-center gap-0 overflow-hidden py-1 ${eff === "chain" ? "bg-accent/10" : ""} cursor-pointer outline-none`}
          style={{ minHeight: 46 }}
        >
          <AnimatePresence initial={false} mode="popLayout">
            {[...chain].reverse().map((b) => (
              <motion.div
                key={b.hash}
                layout
                initial={{ opacity: 0, x: 24, scale: 0.8 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: -24 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className="flex shrink-0 items-center"
              >
                <BlockTile block={b} />
                <span className="px-0.5 text-accent">═</span>
              </motion.div>
            ))}
          </AnimatePresence>
          <span className="shrink-0 text-faint">▸ next</span>
        </div>

        {/* ---- the miners racing ---- */}
        <div className="mb-1 mt-3 text-[0.6rem] text-faint">
          ──── miners racing for the next block{" "}
          {winner && <span className="text-green">· {winner} won!</span>}
        </div>
        <div className={`grid gap-2 ${nMiners === 2 ? "sm:grid-cols-2" : "sm:grid-cols-3"}`}>
          {miners.map((mn) => (
            <div
              key={mn.id}
              {...hoverProps("miner")}
              className={`border p-2 text-[0.62rem] leading-relaxed ${
                mn.won ? "border-green bg-green/10" : eff === "miner" ? "border-accent/60 bg-accent/10" : "border-border"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-fg">miner {mn.name}</span>
                <span className={mn.won ? "text-green" : "text-faint"}>{mn.won ? "✓ found" : "hashing…"}</span>
              </div>
              <div className="mt-1 text-faint">
                <span {...hoverProps("prevhash")} className="cursor-pointer">
                  prev <span className="text-muted">{prevHash.slice(0, 10)}…</span>
                </span>
              </div>
              <div {...hoverProps("txs")} className="text-faint">
                txs{" "}
                <span className="text-muted">
                  {txCount} · merkle {sha256Short("m" + prevHash + txCount).slice(0, 6)}
                </span>
              </div>
              <div {...hoverProps("nonce")} className="text-faint">
                nonce <span className="text-fg">{mn.nonce.toLocaleString()}</span>
              </div>
              <div {...hoverProps("hash")} className="break-all text-faint">
                hash{" "}
                <span className="text-fg">
                  <span className="text-green">{mn.hash.slice(0, Math.max(mn.zeros, mn.won ? TARGET : 0))}</span>
                  {mn.hash.slice(Math.max(mn.zeros, mn.won ? TARGET : 0), 18)}…
                </span>
              </div>
              <div {...hoverProps("target")} className="mt-0.5 text-faint">
                needs <span className="text-accent">{TARGET} zeros</span> ·{" "}
                <span className={mn.zeros >= 1 ? "text-green" : "text-faint"}>{mn.won ? TARGET : mn.zeros} so far</span>
              </div>
            </div>
          ))}
        </div>

        {/* ---- the mempool ---- */}
        <div className="mb-1 mt-3 text-[0.6rem] text-faint">──── mempool · {mem.length} unconfirmed txs</div>
        <div {...hoverProps("mempool")} className={`flex flex-wrap gap-[2px] p-0.5 ${eff === "mempool" ? "bg-accent/10" : ""} cursor-pointer outline-none`}>
          {mem.map((f, i) => (
            <span key={i} className="h-[6px] w-[6px]" style={{ background: feeToColor(f) }} />
          ))}
        </div>
      </div>

      {/* inspector */}
      <div className="mt-2 border border-border bg-panel/60 p-3 text-left" aria-live="polite" aria-atomic="true">
        {info ? (
          <div>
            <div className="text-[0.7rem] tracking-wide text-accent">{`// ${info.title}`}</div>
            <p className="mt-1 text-xs leading-relaxed text-muted">{info.body}</p>
          </div>
        ) : (
          <div className="text-xs text-muted">
            {`// inspect`} · tap or hover a part — the nonce, the hash, the target, a miner, the chain{" "}
            <span className="text-accent blink">█</span>
          </div>
        )}
      </div>
    </div>
  );
}

function BlockTile({ block }: { block: Block }) {
  return (
    <div className="flex flex-col items-center">
      <div className="grid grid-cols-3 border border-faint" style={{ gap: 1, padding: 1 }}>
        {block.fees.map((f, i) => (
          <span key={i} className="h-[4px] w-[4px]" style={{ background: feeToColor(f) }} />
        ))}
      </div>
      <span className="mt-0.5 text-[0.5rem] text-faint">{block.hash.slice(0, 6)}</span>
    </div>
  );
}
