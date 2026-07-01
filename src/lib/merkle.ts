// One shared 4-transaction block, hashed honestly with real SHA-256, plus the
// stripe-colour rule. Used by both the Merkle page and the SPV page so the
// proof on the SPV page recomputes exactly the Merkle root shown here.

import { sha256 } from "@/lib/sha256";

export const TX_DATA = [
  "Tx0 · alice → bob · 0.10",
  "Tx1 · carol → dave · 0.42",
  "Tx2 · erin → frank · 1.05",
  "Tx3 · gary → heidi · 0.08",
];

export const LEAF = TX_DATA.map((d) => sha256(d)); // Hash0..Hash3
export const H01 = sha256(LEAF[0] + LEAF[1]);
export const H23 = sha256(LEAF[2] + LEAF[3]);
export const ROOT = sha256(H01 + H23);
export const PREV = sha256("block header 839,145"); // previous block's hash

export const HASH_OF: Record<string, string> = {
  h0: LEAF[0],
  h1: LEAF[1],
  h2: LEAF[2],
  h3: LEAF[3],
  h01: H01,
  h23: H23,
  root: ROOT,
};

/** One stripe per hex character. '0' → white (a zero). Otherwise a colour keyed
    to the digit's value, so the same digit is always the same colour. */
export function digitColor(ch: string, grey = false): string {
  const d = parseInt(ch, 16);
  if (d === 0) return "#ffffff";
  if (grey) return `hsl(0, 0%, ${30 + d * 3}%)`;
  return `hsl(${Math.round(((d - 1) / 14) * 320)}, 64%, 55%)`;
}
