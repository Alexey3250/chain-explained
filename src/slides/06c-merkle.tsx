"use client";

import { SlideShell } from "@/components/SlideShell";
import { Reveal } from "@/components/ui";
import MerkleTree from "@/components/MerkleTree";

export default function Merkle() {
  return (
    <SlideShell
      kicker="Money · Merkle tree"
      title="Folding a thousand transactions into one hash"
      lede="A block can hold thousands of transactions, but its header carries a single 32-byte fingerprint — the Merkle root. Hashes are folded in pairs, level by level, until one value stands in for them all. That is also what later lets you throw most of the data away."
    >
      <Reveal className="flex-1">
        <MerkleTree />
      </Reveal>
    </SlideShell>
  );
}
