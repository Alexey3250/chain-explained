// Tiny SHA-256 helpers built on the browser's Web Crypto API.
// Used by the interactive hashing and mining slides.

const encoder = new TextEncoder();

export function bytesToHex(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i].toString(16).padStart(2, "0");
  }
  return out;
}

/** SHA-256 of a UTF-8 string, returned as lowercase hex. */
export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(input));
  return bytesToHex(new Uint8Array(digest));
}

/** SHA-256 returning raw bytes (used for chained / double hashing). */
export async function sha256Bytes(input: string): Promise<Uint8Array> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(input));
  return new Uint8Array(digest);
}

/** Count leading zero hex characters — our stand-in for mining "difficulty". */
export function leadingZeros(hex: string): number {
  let n = 0;
  for (const ch of hex) {
    if (ch === "0") n++;
    else break;
  }
  return n;
}

/** Fraction (0..1) of how different two equal-length hex strings are. */
export function hexDifference(a: string, b: string): number {
  const len = Math.min(a.length, b.length);
  if (len === 0) return 0;
  let diff = 0;
  for (let i = 0; i < len; i++) if (a[i] !== b[i]) diff++;
  return diff / len;
}

/** Shorten a long hash/key for display: "abcd…wxyz". */
export function truncateMiddle(s: string, head = 8, tail = 8): string {
  if (s.length <= head + tail + 1) return s;
  return `${s.slice(0, head)}…${s.slice(-tail)}`;
}
