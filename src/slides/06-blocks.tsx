"use client";

import { SlideShell } from "@/components/SlideShell";
import { Mono, Panel, Pill, Reveal } from "@/components/ui";

export default function Blocks() {
  return (
    <SlideShell
      kicker="Money · Blocks"
      title="Transactions get bundled into blocks"
      lede="Roughly every 10 minutes, pending transactions are packed into a block. Each block carries a small header — and the header points back to the one before it."
    >
      <div className="grid flex-1 items-center gap-6 lg:grid-cols-[1.25fr_0.75fr]">
        <Reveal className="flex items-stretch gap-3 overflow-x-auto scroll-thin pb-2">
          <Block height={840000} prev="00000000…a91f" muted />
          <Linker />
          <Block height={840001} prev="00000000…3e7c" highlight />
          <Linker />
          <Block height={840002} prev="00000000…b4d2" muted />
        </Reveal>

        <Reveal delay={0.15} className="space-y-4">
          <Field label="prev block hash" desc="links to the block before — this is the 'chain'." tone="accent" />
          <Field label="merkle root" desc="one hash summarising every transaction inside." />
          <Field label="timestamp" desc="roughly when the block was made." />
          <Field label="nonce" desc="a number miners tweak — you'll see why next." tone="accent" />
          <p className="text-sm text-muted">
            Because each header includes the <span className="text-accent">previous block&apos;s hash</span>,
            the blocks form a single, ordered line stretching back to the very
            first one in 2009.
          </p>
        </Reveal>
      </div>
    </SlideShell>
  );
}

function Block({
  height,
  prev,
  highlight = false,
  muted = false,
}: {
  height: number;
  prev: string;
  highlight?: boolean;
  muted?: boolean;
}) {
  return (
    <Panel
      glow={highlight}
      className={`min-w-[220px] shrink-0 p-4 ${muted ? "opacity-60" : ""}`}
    >
      <div className="flex items-center justify-between">
        <Pill tone={highlight ? "accent" : "default"}>Block #{height}</Pill>
      </div>
      <div className="mt-3 space-y-2 text-xs">
        <Row k="prev" v={prev} accent />
        <Row k="merkle" v="9f2c…71ab" />
        <Row k="nonce" v="2,471,109" />
      </div>
      <div className="mt-3 rounded-lg border border-border bg-bg-soft p-2">
        <div className="text-[0.65rem] uppercase tracking-widest text-faint">
          transactions
        </div>
        <div className="mt-1 grid grid-cols-6 gap-1">
          {Array.from({ length: 12 }).map((_, i) => (
            <span key={i} className="h-2 rounded-sm bg-accent/40" />
          ))}
        </div>
      </div>
    </Panel>
  );
}

function Row({ k, v, accent = false }: { k: string; v: string; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-faint">{k}</span>
      <Mono tone={accent ? "accent" : "muted"}>{v}</Mono>
    </div>
  );
}

function Linker() {
  return (
    <div className="flex shrink-0 items-center">
      <div className="h-px w-6 bg-accent/60" />
      <span className="text-accent">🔗</span>
      <div className="h-px w-6 bg-accent/60" />
    </div>
  );
}

function Field({
  label,
  desc,
  tone = "default",
}: {
  label: string;
  desc: string;
  tone?: "default" | "accent";
}) {
  return (
    <div className="rounded-xl border border-border bg-panel/50 p-3">
      <Mono tone={tone === "accent" ? "accent" : "default"}>{label}</Mono>
      <div className="mt-0.5 text-sm text-muted">{desc}</div>
    </div>
  );
}
