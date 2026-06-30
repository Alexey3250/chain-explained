// Shared fee-rate → colour scale (log, green → amber → red).
// Used by the live mempool treemap and the replisome visualization.

const STOPS: [number, [number, number, number]][] = [
  [1, [27, 94, 75]],
  [3, [46, 125, 80]],
  [8, [124, 170, 60]],
  [20, [205, 185, 52]],
  [50, [247, 147, 26]],
  [150, [229, 103, 95]],
];

const rgb = (c: number[]) => `rgb(${c[0]},${c[1]},${c[2]})`;

/** Map a fee rate (sat/vB) to a colour on the green→amber→red scale. */
export function feeToColor(f: number): string {
  const x = Number.isFinite(f) && f > 0 ? f : 1;
  if (x <= STOPS[0][0]) return rgb(STOPS[0][1]);
  for (let i = 1; i < STOPS.length; i++) {
    if (x <= STOPS[i][0]) {
      const [f0, c0] = STOPS[i - 1];
      const [f1, c1] = STOPS[i];
      const t = (Math.log(x) - Math.log(f0)) / (Math.log(f1) - Math.log(f0));
      return rgb(c0.map((c, k) => Math.round(c + (c1[k] - c) * t)));
    }
  }
  return rgb(STOPS[STOPS.length - 1][1]);
}
