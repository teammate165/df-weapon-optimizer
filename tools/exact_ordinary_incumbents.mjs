// Nonnegative finite binary64 numbers have the same ordering as their unsigned
// bit patterns. Publish only witness-backed scores, with strict pruning at the
// receiver so tied handling and price remain searchable.
export function sharedExactIncumbents(buffer) {
  const cells = new BigUint64Array(buffer);
  const scratch = new DataView(new ArrayBuffer(8));
  const index = cost => cost === null ? 0 : Number.isSafeInteger(cost) && cost >= 0 ? cost + 1 : -1;
  const lookup = slot => slot >= 0 && slot < cells.length;
  const toLoss = bits => {
    if (bits === 0n) return Infinity;
    scratch.setBigUint64(0, bits - 1n);
    return scratch.getFloat64(0);
  };
  return {
    lossAt(cost) {
      const slot = index(cost);
      return lookup(slot) ? toLoss(Atomics.load(cells, slot)) : Infinity;
    },
    publish(cost, loss) {
      const slot = index(cost);
      if (!lookup(slot) || !Number.isFinite(loss) || loss < 0) return;
      scratch.setFloat64(0, loss === 0 ? 0 : loss);
      const next = scratch.getBigUint64(0) + 1n;
      let previous = Atomics.load(cells, slot);
      while (previous === 0n || next < previous) {
        const observed = Atomics.compareExchange(cells, slot, previous, next);
        if (observed === previous) return;
        previous = observed;
      }
    },
  };
}
