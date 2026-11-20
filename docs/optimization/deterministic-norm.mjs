// Native binary64 arithmetic with a correctly rounded normalized square root.
// The Math.sqrt estimate is optional work reduction, verified with integers.
const SCALE = 4503599627370496; // 2^52
const FRACTION_BITS = 52n;

function roundedRoot(sum) {
  const radicand = BigInt(sum * SCALE) << FRACTION_BITS;
  const estimate = Math.sqrt(sum) * SCALE;
  let root = Number.isSafeInteger(estimate) && estimate >= SCALE && estimate < 2 * SCALE
    ? BigInt(estimate) : 0n;
  if (root && root * root > radicand) root--;
  if (root && (root + 1n) * (root + 1n) <= radicand) root++;
  if (!root || root * root > radicand || (root + 1n) * (root + 1n) <= radicand) {
    root = 1n << 53n;
    for (;;) {
      const next = (root + radicand / root) >> 1n;
      if (next >= root) break;
      root = next;
    }
  }
  const midpoint = 2n * root + 1n;
  if (4n * radicand > midpoint * midpoint) root++;
  return Number(root) / SCALE;
}

export function deterministicHypot(x, y) {
  const a = Math.abs(x), b = Math.abs(y);
  if (a === Infinity || b === Infinity) return Infinity;
  const maximum = Math.max(a, b);
  if (maximum === 0 || Number.isNaN(maximum)) return maximum;
  const ratio = Math.min(a, b) / maximum;
  return roundedRoot(1 + ratio * ratio) * maximum;
}

function minimumMagnitude([lo, hi]) {
  return lo <= 0 && hi >= 0 ? 0 : Math.min(Math.abs(lo), Math.abs(hi));
}
export function deterministicNormFloor(a, b) {
  const minimumA = minimumMagnitude(a), minimumB = minimumMagnitude(b);
  const minimumMaximum = Math.max(minimumA, minimumB);
  if (minimumMaximum === 0) return 0;
  const maximumMaximum = Math.max(...a.map(Math.abs), ...b.map(Math.abs));
  const lowerRatio = Math.min(minimumA, minimumB) / maximumMaximum;
  return roundedRoot(1 + lowerRatio * lowerRatio) * minimumMaximum;
}

export const deterministicNorm = Object.freeze({
  version: 'binary64-normalized-hypot-v1',
  evaluate: deterministicHypot,
});
