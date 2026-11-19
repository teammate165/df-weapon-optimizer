const point = value => [value, value];
const bits = new DataView(new ArrayBuffer(8));
function next(value, upward) {
  if (!Number.isFinite(value)) throw Error('Nonfinite enclosure');
  if (value === 0) return upward ? Number.MIN_VALUE : -Number.MIN_VALUE;
  bits.setFloat64(0, value);
  const encoded = bits.getBigUint64(0);
  bits.setBigUint64(0, encoded + ((value > 0) === upward ? 1n : -1n));
  const result = bits.getFloat64(0);
  if (!Number.isFinite(result)) throw Error('Enclosure overflow');
  return result;
}
function outward(lo, hi) { return [next(lo, false), next(hi, true)]; }
function plus(a, b) { return outward(a[0] + b[0], a[1] + b[1]); }
function mult(a, b) {
  const values = [a[0] * b[0], a[0] * b[1], a[1] * b[0], a[1] * b[1]];
  return outward(Math.min(...values), Math.max(...values));
}
function eachSum(exact, magnitude, count, integers) {
  if (!count || magnitude === 0) return exact;
  if (integers && magnitude <= Number.MAX_SAFE_INTEGER) return exact;
  const ceiling = next(2 * magnitude, true);
  const ulp = next(ceiling, true) - ceiling;
  const error = next(count * ulp, true);
  if (error > magnitude / 2) throw Error('Unsupported sum magnitude');
  return outward(exact[0] - error, exact[1] + error);
}
const integer = a => a.every(Number.isSafeInteger);
const addIntegers = (a, b) => {
  const values = [a[0] + b[0], a[1] + b[1]];
  return integer(values) ? values : plus(a, b);
};
export function foldedAddGroups(groups) {
  let exact = point(0), magnitude = 0, count = 0, integers = true;
  for (const alternatives of groups) {
    let lo = Infinity, hi = -Infinity, size = 0, absolute = 0;
    for (const atoms of alternatives) {
      const int = atoms.every(integer);
      const magnitudes = atoms.map(a => Math.max(...a.map(Math.abs)));
      const intSum = int ? magnitudes.reduce((sum, value) => sum + BigInt(value), 0n) : null;
      const safe = intSum !== null && intSum <= BigInt(Number.MAX_SAFE_INTEGER);
      const range = atoms.reduce(safe ? addIntegers : plus, point(0));
      lo = Math.min(lo, range[0]); hi = Math.max(hi, range[1]);
      absolute = Math.max(absolute, safe ? Number(intSum) :
        magnitudes.reduce((sum, value) => next(sum + value, true), 0));
      size = Math.max(size, atoms.length);
      integers &&= safe;
    }
    const combinedMagnitude = magnitude + absolute;
    const safe = integers && Number.isSafeInteger(combinedMagnitude) &&
      BigInt(magnitude) + BigInt(absolute) <= BigInt(Number.MAX_SAFE_INTEGER);
    exact = (safe ? addIntegers : plus)(exact, [lo, hi]);
    magnitude = safe ? combinedMagnitude : next(combinedMagnitude, true);
    integers = safe;
    count += size;
  }
  return eachSum(exact, magnitude, count, integers);
}
export function foldedProductGroups(groups) {
  let exact = point(1), min = 1, max = 1, count = 0;
  for (const alternatives of groups) {
    let lo = Infinity, hi = -Infinity, size = 0, smallest = 1, largest = 1;
    for (const atoms of alternatives) {
      if (atoms.some(a => a[0] <= 0 && a[1] >= 0)) throw Error('Zero-crossing product');
      const range = atoms.reduce(mult, point(1));
      lo = Math.min(lo, range[0]); hi = Math.max(hi, range[1]);
      smallest = Math.min(smallest, atoms.reduce((v,a) =>
        next(v * Math.min(1, ...a.map(Math.abs)), false), 1));
      largest = Math.max(largest, atoms.reduce((v,a) =>
        next(v * Math.max(1, ...a.map(Math.abs)), true), 1));
      size = Math.max(size, atoms.length);
    }
    if (!size) continue;
    exact = mult(exact, [lo, hi]);
    min = next(min * smallest, false);
    max = next(max * largest, true);
    count += size;
  }
  if (!count) return point(1);
  let factor = point(1);
  for (let i = 0; i < count; i++) factor = mult(factor, [1 - Number.EPSILON, 1 + Number.EPSILON]);
  // Every unrounded prefix is normal and finite even after rounding factors.
  if (!(min > 2 ** -1000) || !(max < 2 ** 1000) ||
      !(factor[0] >= 0.5) || !(factor[1] <= 2)) throw Error('Unsafe product magnitude');
  return mult(exact, factor);
}

const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const sub = (a, b) => [a[0] - b[1], a[1] - b[0]];
function multiply(a, b) {
  const values = [a[0] * b[0], a[0] * b[1], a[1] * b[0], a[1] * b[1]];
  return [Math.min(...values), Math.max(...values)];
}
export function nativeCurveRange(curve, input, exact) {
  if (input[0] === input[1]) {
    const value = exact(curve, input[0]);
    if (!Number.isFinite(value)) throw Error('Unsupported singleton curve');
    return point(value);
  }
  const points = [...curve.points].sort((a, b) => a.inputValue - b.inputValue);
  if (!points.length || !input.every(Number.isFinite)) throw Error('Unsupported curve');
  const candidates = [];
  if (input[0] <= points[0].inputValue) candidates.push(point(points[0].outputValue));
  if (input[1] >= points.at(-1).inputValue) candidates.push(point(points.at(-1).outputValue));
  for (let i = 0; i + 1 < points.length; i++) {
    const a = points[i], b = points[i + 1];
    const lo = Math.max(input[0], a.inputValue), hi = Math.min(input[1], b.inputValue);
    if (lo > hi) continue;
    const width = b.inputValue - a.inputValue;
    if (!(width > 0)) throw Error('Degenerate segment');
    const position = x => (x - a.inputValue) / width;
    const s = [position(lo), position(hi)];
    if (a.interpolationMode !== 'RCIM_Cubic') {
      candidates.push(add(point(a.outputValue), multiply(point(b.outputValue - a.outputValue), s)));
      continue;
    }
    const subdivisions = 16;
    let start = lo;
    for (let part = 1; part <= subdivisions; part++) {
      const end = part === subdivisions ? hi : Math.max(start,
        Math.min(hi, lo + (hi - lo) * part / subdivisions));
      const s = [position(start), position(end)];
      const c = multiply(s, s), l = multiply(c, s);
      const u = add(sub(multiply(point(2), l), multiply(point(3), c)), point(1));
      const d = add(sub(l, multiply(point(2), c)), s);
      const f = add(multiply(point(-2), l), multiply(point(3), c));
      const p = sub(l, c);
      const term = (value, tangent) => multiply(multiply(value, point(width)), point(tangent));
      candidates.push(add(add(add(multiply(u, point(a.outputValue)), term(d, a.leaveTangent)),
        multiply(f, point(b.outputValue))), term(p, b.arriveTangent)));
      start = end;
    }
  }
  if (!candidates.length || candidates.some(range => !range.every(Number.isFinite))) {
    throw Error('Nonfinite curve enclosure');
  }
  return [Math.min(...candidates.map(row => row[0])), Math.max(...candidates.map(row => row[1]))];
}
