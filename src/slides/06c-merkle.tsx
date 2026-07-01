"use client";

import { SlideShell } from "@/components/SlideShell";
import { Reveal } from "@/components/ui";
import MerkleTree from "@/components/MerkleTree";

export default function Merkle() {
  return (
    <SlideShell
      kicker="Money · Merkle tree"
      title="Folding a thousand transactions into one hash"
      lede="Every hash below is its real 64 hex characters — one stripe each, white for a zero. First fold the transactions in pairs up to a single Merkle root; then hash the header and grind the nonce until the block hash starts with a run of white zeros."
    >
      <Reveal className="flex-1">
        <MerkleTree />
      </Reveal>
    </SlideShell>
  );
}
