"use client";

import { SlideShell } from "@/components/SlideShell";
import { Reveal } from "@/components/ui";
import SpvProof from "@/components/SpvProof";

export default function Spv() {
  return (
    <SlideShell
      kicker="Money · Simplified payment verification"
      title="Proving a payment without the whole block"
      lede="A phone wallet can't store the blockchain — but it can still check that a payment landed in a block. It only needs the block header it already trusts, its own transaction, and a short 'branch' of sibling hashes. It recomputes the Merkle root and checks it matches."
    >
      <Reveal className="flex-1">
        <SpvProof />
      </Reveal>
    </SlideShell>
  );
}
