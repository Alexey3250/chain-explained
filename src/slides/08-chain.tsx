"use client";

import { useCallback, useEffect, useState } from "react";
import { SlideShell } from "@/components/SlideShell";
import { Btn, Mono, Pill, Reveal } from "@/components/ui";
import { sha256Hex, truncateMiddle } from "@/lib/hash";

const DIFF = "00"; // require 2 leading zero hex chars (fast to mine)
const GENESIS = "0000000000000000000000000000000000000000000000000000000000000000";

type Blk = {
  index: number;
  data: string;
  nonce: number;
  prev: string;
  hash: string;
  valid: boolean;
};

const SEED = ["Alice → Bob: 5", "Bob → Carol: 3", "Carol → Dave: 1"];

async function hashOf(b: { index: number; data: string; nonce: number; prev: string }) {
  return sha256Hex(`${b.index}|${b.data}|${b.nonce}|${b.prev}`);
}

// Re-link every block to the real previous hash and recompute validity.
async function rechain(blocks: Blk[]): Promise<Blk[]> {
  let prev = GENESIS;
  const out: Blk[] = [];
  for (const b of blocks) {
    const hash = await hashOf({ ...b, prev });
    out.push({ ...b, prev, hash, valid: hash.startsWith(DIFF) });
    prev = hash;
  }
  return out;
}

async function mineBlock(b: Blk): Promise<Blk> {
  let nonce = 0;
  while (true) {
    const hash = await hashOf({ ...b, nonce });
    if (hash.startsWith(DIFF)) return { ...b, nonce, hash, valid: true };
    nonce++;
  }
}

export default function ChainDemo() {
  const [blocks, setBlocks] = useState<Blk[]>([]);
  const [busy, setBusy] = useState(false);

  const init = useCallback(async () => {
    setBusy(true);
    let prev = GENESIS;
    const out: Blk[] = [];
    for (let i = 0; i < SEED.length; i++) {
      const mined = await mineBlock({
        index: i,
        data: SEED[i],
        nonce: 0,
        prev,
        hash: "",
        valid: false,
      });
      out.push(mined);
      prev = mined.hash;
    }
    setBlocks(out);
    setBusy(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    init();
  }, [init]);

  async function edit(i: number, data: string) {
    const draft = blocks.map((b) => (b.index === i ? { ...b, data } : b));
    setBlocks(await rechain(draft));
  }

  async function remine(i: number) {
    setBusy(true);
    const current = blocks[i];
    const mined = await mineBlock(current);
    const draft = blocks.map((b) => (b.index === i ? mined : b));
    setBlocks(await rechain(draft));
    setBusy(false);
  }

  return (
    <SlideShell
      kicker="Consensus · Immutability"
      title="Why you can't quietly rewrite history"
      lede="Each block's hash depends on the one before it. Edit any block and its hash breaks — and so does every block after it. Try it."
    >
      <div className="grid flex-1 items-start gap-6 lg:grid-cols-[1.35fr_0.65fr]">
        <Reveal className="flex gap-3 overflow-x-auto scroll-thin pb-3">
          {blocks.map((b) => (
            <BlockCard
              key={b.index}
              b={b}
              busy={busy}
              onEdit={(v) => edit(b.index, v)}
              onRemine={() => remine(b.index)}
            />
          ))}
          {blocks.length === 0 && (
            <div className="p-6 text-sm text-faint">mining genesis chain…</div>
          )}
        </Reveal>

        <Reveal delay={0.15} className="space-y-4">
          <Point text="Type into any block's data — its hash instantly stops starting with 00. It's now invalid (red)." />
          <Point text="Notice every block to the right turns red too: their 'prev' no longer matches." />
          <Point text="Re-mine fixes one block — but breaks the link to the next. You'd have to re-mine them all." />
          <div className="rounded-xl border border-accent/30 bg-accent/5 p-4 text-sm">
            Now imagine thousands of blocks, each needing quintillions of guesses.
            Rewriting one old transaction means re-doing{" "}
            <span className="text-accent">all</span> the work since — faster than
            the rest of the planet combined. That&apos;s immutability.
          </div>
          <Btn variant="ghost" onClick={init} disabled={busy} className="w-full">
            ↻ Reset the chain
          </Btn>
        </Reveal>
      </div>
    </SlideShell>
  );
}

function BlockCard({
  b,
  busy,
  onEdit,
  onRemine,
}: {
  b: Blk;
  busy: boolean;
  onEdit: (v: string) => void;
  onRemine: () => void;
}) {
  const ok = b.valid;
  return (
    <div
      className={`min-w-[210px] shrink-0 rounded-2xl border p-4 transition-colors ${
        ok ? "border-green/40 bg-green/5" : "border-red/50 bg-red/10"
      }`}
    >
      <div className="flex items-center justify-between">
        <Pill tone={ok ? "green" : "red"}>Block #{b.index + 1}</Pill>
        <span className={ok ? "text-green" : "text-red"}>{ok ? "✓" : "✗"}</span>
      </div>

      <label className="mt-3 block text-[0.65rem] uppercase tracking-widest text-faint">
        data
      </label>
      <textarea
        value={b.data}
        onChange={(e) => onEdit(e.target.value)}
        rows={2}
        spellCheck={false}
        className="mt-1 w-full resize-none rounded-lg border border-border bg-bg-soft px-2 py-1.5 font-mono text-xs outline-none focus:border-accent"
      />

      <div className="mt-2 space-y-1 text-[0.7rem]">
        <KV k="nonce" v={b.nonce.toLocaleString()} />
        <KV k="prev" v={truncateMiddle(b.prev, 6, 4)} />
        <div className="flex items-center justify-between gap-2">
          <span className="text-faint">hash</span>
          <span className="font-mono">
            <span className={ok ? "text-green" : "text-red"}>
              {b.hash.slice(0, 2)}
            </span>
            <Mono tone="muted">{truncateMiddle(b.hash.slice(2), 4, 4)}</Mono>
          </span>
        </div>
      </div>

      {!ok && (
        <Btn onClick={onRemine} disabled={busy} className="mt-3 w-full !py-1.5 text-xs">
          {busy ? "…" : "⛏ Re-mine"}
        </Btn>
      )}
    </div>
  );
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-faint">{k}</span>
      <Mono tone="muted">{v}</Mono>
    </div>
  );
}

function Point({ text }: { text: string }) {
  return (
    <div className="flex gap-2.5">
      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
      <p className="text-sm text-muted">{text}</p>
    </div>
  );
}
