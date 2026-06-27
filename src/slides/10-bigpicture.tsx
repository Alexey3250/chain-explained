"use client";

import { useCallback, useEffect, useState } from "react";
import { SlideShell } from "@/components/SlideShell";
import { Btn, Mono, Panel, Pill, Reveal } from "@/components/ui";
import { truncateMiddle } from "@/lib/hash";

type Live = {
  height: number | null;
  hash: string | null;
  fee: number | null;
  mempool: number | null;
};

const API = "https://mempool.space/api";

export default function BigPicture() {
  const [live, setLive] = useState<Live>({
    height: null,
    hash: null,
    fee: null,
    mempool: null,
  });
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");

  const load = useCallback(async () => {
    setState("loading");
    try {
      const [height, hash, fees, mempool] = await Promise.all([
        fetch(`${API}/blocks/tip/height`).then((r) => r.text()),
        fetch(`${API}/blocks/tip/hash`).then((r) => r.text()),
        fetch(`${API}/v1/fees/recommended`).then((r) => r.json()),
        fetch(`${API}/mempool`).then((r) => r.json()),
      ]);
      setLive({
        height: Number(height),
        hash,
        fee: fees?.fastestFee ?? null,
        mempool: mempool?.count ?? null,
      });
      setState("ok");
    } catch {
      setState("error");
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, [load]);

  return (
    <SlideShell
      kicker="The big picture"
      title="Put it together — and look up"
      lede="Every piece you just met is running right now, in concert, with no one in charge. Here's the live network as you read this."
    >
      <div className="grid flex-1 items-start gap-6 lg:grid-cols-2">
        <Reveal className="space-y-2.5">
          <Recap n="①" t="Hash" d="the fingerprint that ties everything together" />
          <Recap n="②" t="Keys" d="signatures prove who may spend a coin" />
          <Recap n="③" t="Transactions" d="value moves as inputs and outputs" />
          <Recap n="④" t="Blocks" d="transactions bundled, each linked to the last" />
          <Recap n="⑤" t="Proof of work" d="mining makes new blocks costly to forge" />
          <Recap n="⑥" t="The chain" d="that cost makes history practically unchangeable" />
          <Recap n="⑦" t="The network" d="thousands of nodes agree, with no boss" />
        </Reveal>

        <Reveal delay={0.15}>
          <Panel className="p-6" glow>
            <div className="flex items-center justify-between">
              <Pill tone={state === "ok" ? "green" : state === "error" ? "red" : "accent"}>
                <span
                  className={`inline-block h-2 w-2 rounded-full ${
                    state === "ok"
                      ? "animate-pulse bg-green"
                      : state === "error"
                        ? "bg-red"
                        : "bg-accent"
                  }`}
                />
                {state === "ok" ? "LIVE" : state === "error" ? "offline" : "connecting…"}
              </Pill>
              <Btn variant="ghost" onClick={load} className="!px-3 !py-1.5 text-xs">
                ↻ refresh
              </Btn>
            </div>

            <div className="mt-5 space-y-3">
              <LiveStat
                label="Current block height"
                value={live.height != null ? `#${live.height.toLocaleString()}` : "…"}
                big
              />
              <LiveStat
                label="Latest block hash"
                value={
                  live.hash ? (
                    <Mono tone="accent">{truncateMiddle(live.hash, 10, 10)}</Mono>
                  ) : (
                    "…"
                  )
                }
              />
              <div className="grid grid-cols-2 gap-3">
                <LiveStat
                  label="Fastest fee"
                  value={live.fee != null ? `${live.fee} sat/vB` : "…"}
                />
                <LiveStat
                  label="Txs waiting"
                  value={
                    live.mempool != null ? live.mempool.toLocaleString() : "…"
                  }
                />
              </div>
            </div>

            <p className="mt-5 text-xs text-faint">
              {state === "error"
                ? "Couldn't reach the network just now — but it's still out there, ticking every ~10 minutes."
                : "Live data from mempool.space · auto-refreshes every 30s."}
            </p>
          </Panel>
        </Reveal>
      </div>
    </SlideShell>
  );
}

function Recap({ n, t, d }: { n: string; t: string; d: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-panel/40 px-3 py-2">
      <span className="text-lg text-accent">{n}</span>
      <span className="font-semibold text-fg">{t}</span>
      <span className="text-sm text-muted">— {d}</span>
    </div>
  );
}

function LiveStat({
  label,
  value,
  big = false,
}: {
  label: string;
  value: React.ReactNode;
  big?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-bg-soft px-4 py-3">
      <div className="text-[0.7rem] uppercase tracking-widest text-faint">
        {label}
      </div>
      <div
        className={`mt-1 font-mono font-semibold text-fg ${
          big ? "text-3xl text-accent" : "text-base"
        }`}
      >
        {value}
      </div>
    </div>
  );
}
