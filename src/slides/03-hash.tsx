"use client";

import { motion } from "motion/react";
import { useMemo, useState } from "react";
import { BlackBox, Gears } from "@/components/HashMachine";
import { SlideShell } from "@/components/SlideShell";
import { AsciiRule, Panel } from "@/components/ui";
import { shaTrace } from "@/lib/sha256-rounds";

export default function Hash() {
  const [msg, setMsg] = useState("Bitcoin");
  const [showGears, setShowGears] = useState(false);

  const trace = useMemo(() => shaTrace(msg), [msg]);

  return (
    <SlideShell
      kicker="foundations · the hash"
      title="a one-way fingerprint machine"
      lede="feed in any text and out comes a fixed 64-character fingerprint. the same input always gives the same output — yet there is no way to run the machine backwards."
    >
      <div className="flex flex-col gap-6">
        {/* the lesson's centre of attention: type into the machine */}
        <BlackBox trace={trace} msg={msg} onChange={setMsg} />

        <p className="text-center font-mono text-xs leading-relaxed text-faint">
          change a single character above — almost the entire fingerprint
          changes, and the new one tells you nothing about the old.
        </p>

        {/* why this one property set is what bitcoin is built on */}
        <div className="mt-1">
          <AsciiRule label="why bitcoin leans on it" />
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <Why
              p="one-way"
              d="mining is real work — you can't reverse a target into the answer, only keep guessing."
            />
            <Why
              p="deterministic"
              d="every node computes the same hash, so the whole network agrees with no referee."
            />
            <Why
              p="collision-proof"
              d="no two inputs share a fingerprint, so a fake transaction can't pose as a real one."
            />
          </div>
        </div>

        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => setShowGears((s) => !s)}
            className="font-mono text-sm text-muted underline decoration-dotted underline-offset-4 transition hover:text-accent"
          >
            {showGears ? "[-] hide the gears" : "[+] look inside the machine"}
          </button>
        </div>

        {showGears && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="w-full"
          >
            <Gears trace={trace} msg={msg} />
          </motion.div>
        )}
      </div>
    </SlideShell>
  );
}

function Why({ p, d }: { p: string; d: string }) {
  return (
    <Panel className="p-3.5">
      <div className="font-mono text-sm text-accent">&gt; {p}</div>
      <p className="mt-1.5 font-mono text-xs leading-relaxed text-muted">{d}</p>
    </Panel>
  );
}
