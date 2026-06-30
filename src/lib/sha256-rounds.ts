// A transparent, round-by-round SHA-256 for a single 512-bit block.
// Unlike the Web Crypto digest (a black box), this exposes every intermediate
// state so we can animate the eight working registers as they churn.
//
// Limited to messages that fit in one block (≤ 55 bytes) — enough to watch
// the whole machine fire end-to-end.

const K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
  0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
  0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
  0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
  0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
  0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];

const IV = [
  0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c,
  0x1f83d9ab, 0x5be0cd19,
];

const rotr = (x: number, n: number) => ((x >>> n) | (x << (32 - n))) >>> 0;
const add = (...xs: number[]) => xs.reduce((s, x) => s + x, 0) >>> 0;

export const bigSig0 = (x: number) =>
  (rotr(x, 2) ^ rotr(x, 13) ^ rotr(x, 22)) >>> 0;
export const bigSig1 = (x: number) =>
  (rotr(x, 6) ^ rotr(x, 11) ^ rotr(x, 25)) >>> 0;
export const ch = (e: number, f: number, g: number) =>
  ((e & f) ^ (~e & g)) >>> 0;
export const maj = (a: number, b: number, c: number) =>
  ((a & b) ^ (a & c) ^ (b & c)) >>> 0;
export const add32 = (...xs: number[]) => add(...xs);
const smallSig0 = (x: number) => rotr(x, 7) ^ rotr(x, 18) ^ (x >>> 3);
const smallSig1 = (x: number) => rotr(x, 17) ^ rotr(x, 19) ^ (x >>> 10);

export type RoundState = [number, number, number, number, number, number, number, number];

export type ShaTrace = {
  /** 65 snapshots of [a..h]: index 0 is the IV, 1..64 after each round. */
  states: RoundState[];
  /** the 64 message-schedule words actually fed in (one per round). */
  W: number[];
  /** the 64 round constants. */
  K: number[];
  /** the final 256-bit digest as 64 lowercase hex chars. */
  digest: string;
  /** true if the message had to be truncated to fit one block. */
  truncated: boolean;
  /** the padded 512-bit block, as 64 bytes. */
  block: number[];
  /** number of bytes of the (possibly truncated) message. */
  msgLen: number;
  /** the 8 initial hash values. */
  iv: number[];
  /** the 8 final 32-bit words whose hex makes up the digest. */
  finalWords: number[];
};

function padBlock(msg: string): { block: Uint8Array; truncated: boolean } {
  const bytes = new TextEncoder().encode(msg);
  const truncated = bytes.length > 55;
  const data = truncated ? bytes.slice(0, 55) : bytes;
  const block = new Uint8Array(64);
  block.set(data);
  block[data.length] = 0x80; // append the '1' bit
  const bits = data.length * 8;
  // 64-bit big-endian length in the last 8 bytes (fits in 32 bits here)
  block[60] = (bits >>> 24) & 0xff;
  block[61] = (bits >>> 16) & 0xff;
  block[62] = (bits >>> 8) & 0xff;
  block[63] = bits & 0xff;
  return { block, truncated };
}

export function shaTrace(msg: string): ShaTrace {
  const { block, truncated } = padBlock(msg);

  // message schedule
  const W = new Array<number>(64);
  for (let t = 0; t < 16; t++) {
    W[t] =
      ((block[t * 4] << 24) |
        (block[t * 4 + 1] << 16) |
        (block[t * 4 + 2] << 8) |
        block[t * 4 + 3]) >>>
      0;
  }
  for (let t = 16; t < 64; t++) {
    W[t] = add(smallSig1(W[t - 2]), W[t - 7], smallSig0(W[t - 15]), W[t - 16]);
  }

  let [a, b, c, d, e, f, g, h] = IV;
  const states: RoundState[] = [[a, b, c, d, e, f, g, h]];

  for (let t = 0; t < 64; t++) {
    const T1 = add(h, bigSig1(e), ch(e, f, g), K[t], W[t]);
    const T2 = add(bigSig0(a), maj(a, b, c));
    h = g;
    g = f;
    f = e;
    e = add(d, T1);
    d = c;
    c = b;
    b = a;
    a = add(T1, T2);
    states.push([a, b, c, d, e, f, g, h]);
  }

  const finalWords = states[64].map((v, i) => add(v, IV[i]));
  const digest = finalWords
    .map((w) => w.toString(16).padStart(8, "0"))
    .join("");

  const msgLen = Math.min(new TextEncoder().encode(msg).length, 55);

  return {
    states,
    W,
    K: K.slice(),
    digest,
    truncated,
    block: Array.from(block),
    msgLen,
    iv: IV.slice(),
    finalWords,
  };
}

/** Fast synchronous SHA-256 of a short string (≤55 bytes), as 64 hex chars.
    Used for the live proof-of-work mining loop. */
export function sha256Short(msg: string): string {
  const { block } = padBlock(msg);
  const W = new Array<number>(64);
  for (let t = 0; t < 16; t++) {
    W[t] =
      ((block[t * 4] << 24) |
        (block[t * 4 + 1] << 16) |
        (block[t * 4 + 2] << 8) |
        block[t * 4 + 3]) >>>
      0;
  }
  for (let t = 16; t < 64; t++) {
    W[t] = add(smallSig1(W[t - 2]), W[t - 7], smallSig0(W[t - 15]), W[t - 16]);
  }
  let [a, b, c, d, e, f, g, h] = IV;
  for (let t = 0; t < 64; t++) {
    const T1 = add(h, bigSig1(e), ch(e, f, g), K[t], W[t]);
    const T2 = add(bigSig0(a), maj(a, b, c));
    h = g;
    g = f;
    f = e;
    e = add(d, T1);
    d = c;
    c = b;
    b = a;
    a = add(T1, T2);
  }
  return [a, b, c, d, e, f, g, h]
    .map((v, i) => add(v, IV[i]).toString(16).padStart(8, "0"))
    .join("");
}

/** Expand a 32-bit word into 32 bits, most-significant first. */
export function toBits(x: number): number[] {
  const out = new Array<number>(32);
  for (let i = 0; i < 32; i++) out[i] = (x >>> (31 - i)) & 1;
  return out;
}

export const hex8 = (x: number) => (x >>> 0).toString(16).padStart(8, "0");
