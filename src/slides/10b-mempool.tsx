"use client";

import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useState } from "react";
import { SlideShell } from "@/components/SlideShell";
import { Panel, Pill } from "@/components/ui";

const API = "https://mempool.space/api";

type Projected = {
  nTx: number;
  medianFee: number;
  lo: number;
  hi: number;
  sizeMB: number;
};
type RecentTx = {
  txid: string;
  valueBtc: number;
  vsize: number;
  feeRate: number;
};
type Data = {
  count: number;
  vsizeMB: number;
  blocks: Projected[];
  recent: RecentTx[];
};

function feeColor(rate: number): string {
  if (rate < 8) return "var(--green)";
  if (rate <= 30) return "var(--accent)";
  return "var(--red)";
}

export default function Mempool() {
  const [data, setData] = useState<Data | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");

  const load = useCallback(async () => {
    try {
      const [mp, blocks, recent] = await Promise.all([
        fetch(`${API}/mempool`).then((r) => r.json()),
        fetch(`${API}/v1/fees/mempool-blocks`).then((r) => r.json()),
        fetch(`${API}/mempool/recent`).then((r) => r.json()),
      ]);
      setData({
        count: mp.count ?? 0,
        vsizeMB: (mp.vsize ?? 0) / 1_000_000,
        blocks: (blocks as Array<Record<string, number | number[]>>)
          .slice(0, 6)
          .map((b) => {
            const range = (b.feeRange as number[]) ?? [0];
            return {
              nTx: b.nTx as number,
              medianFee: Math.round(b.medianFee as number),
              lo: Math.round(range[0]),
              hi: Math.round(range[range.length - 1]),
              sizeMB: (b.blockVSize as number) / 1_000_000,
            };
          }),
        recent: (recent as Array<Record<string, number | string>>)
          .slice(0, 12)
          .map((t) => ({
            txid: t.txid as string,
            valueBtc: (t.value as number) / 1e8,
            vsize: t.vsize as number,
            feeRate: Math.max(1, Math.round((t.fee as number) / (t.vsize as number))),
          })),
      });
      setState("ok");
    } catch {
      setState("error");
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    const id = setInterval(load, 6000);
    return () => clearInterval(id);
  }, [load]);

  return (
    <SlideShell
      kicker="the network · live"
      title="inside the mempool, right now"
      lede="before a transaction is mined it waits in the mempool — the network's shared waiting room. miners pick the highest-fee transactions first. this is the real backlog, streaming live."
    >
      <div className="flex flex-col gap-5">
        {/* status + headline stats */}
        <div className="flex flex-wrap items-center gap-3">
          <Pill tone={state === "ok" ? "green" : state === "error" ? "red" : "accent"}>
            <span
              className={`inline-block h-2 w-2 ${
                state === "ok" ? "animate-pulse bg-green" : state === "error" ? "bg-red" : "bg-accent"
              }`}
            />
            {state === "ok" ? "live" : state === "error" ? "offline" : "connecting…"}
          </Pill>
          <Stat label="waiting" value={data ? `${data.count.toLocaleString()} txs` : "…"} />
          <Stat label="backlog" value={data ? `${data.vsizeMB.toFixed(1)} vMB` : "…"} />
          <Stat
            label="next-block fee"
            value={data?.blocks[0] ? `~${data.blocks[0].medianFee} sat/vB` : "…"}
          />
        </div>

        {/* projected blocks miners will build next */}
        <div>
          <div className="mb-2 font-mono text-xs text-faint">
            {"// upcoming blocks — what miners will pack next (highest fees first)"}
          </div>
          <div className="flex gap-2 overflow-x-auto scroll-thin pb-1">
            {!data && <Skeleton n={4} />}
            {data?.blocks.map((b, i) => {
              const c = feeColor(b.medianFee);
              return (
                <div
                  key={i}
                  className="min-w-[130px] shrink-0 border p-3"
                  style={{ borderColor: c, background: `${c}14` }}
                >
                  <div className="font-mono text-[0.65rem] text-faint">
                    {i === 0 ? "next block" : `+${i} block`}
                  </div>
                  <div className="mt-1 font-mono text-lg font-bold" style={{ color: c }}>
                    {b.medianFee}
                    <span className="text-xs font-normal text-faint"> sat/vB</span>
                  </div>
                  <div className="mt-1 font-mono text-[0.65rem] text-muted">
                    {b.lo}–{b.hi} sat/vB
                  </div>
                  <div className="mt-2 font-mono text-[0.65rem] text-faint">
                    ~{b.nTx.toLocaleString()} tx · {b.sizeMB.toFixed(2)} MB
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* live incoming transaction feed */}
        <div>
          <div className="mb-2 font-mono text-xs text-faint">
            {"// arriving now — newest unconfirmed transactions"}
          </div>
          <Panel className="h-[200px] overflow-y-auto scroll-thin p-3">
            {state === "error" ? (
              <p className="font-mono text-xs text-red">
                couldn&apos;t reach the network — but it&apos;s still out there,
                ticking every ~10 minutes.
              </p>
            ) : !data ? (
              <p className="font-mono text-xs text-faint">connecting to the bitcoin network…</p>
            ) : (
              <div className="space-y-1">
                <AnimatePresence initial={false}>
                  {data.recent.map((t) => (
                    <motion.div
                      key={t.txid}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      className="flex items-center gap-3 font-mono text-[0.7rem]"
                    >
                      <span className="text-faint">tx</span>
                      <span className="text-blue">{t.txid.slice(0, 10)}…</span>
                      <span className="ml-auto text-muted">
                        {t.valueBtc.toLocaleString(undefined, { maximumFractionDigits: 3 })} BTC
                      </span>
                      <span className="w-20 text-right" style={{ color: feeColor(t.feeRate) }}>
                        {t.feeRate} sat/vB
                      </span>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </Panel>
        </div>

        <p className="font-mono text-[0.7rem] text-faint">
          live data from mempool.space · refreshes every 6s. a transaction
          leaves this room the moment a miner includes it in a block.
        </p>
      </div>
    </SlideShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-border bg-bg-soft px-3 py-1.5">
      <span className="font-mono text-[0.6rem] uppercase tracking-widest text-faint">
        {label}
      </span>
      <div className="font-mono text-sm font-semibold text-fg">{value}</div>
    </div>
  );
}

function Skeleton({ n }: { n: number }) {
  return (
    <>
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="h-[96px] min-w-[130px] shrink-0 border border-border bg-panel" />
      ))}
    </>
  );
}
