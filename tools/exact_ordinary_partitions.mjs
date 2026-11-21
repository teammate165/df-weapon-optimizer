// Each explicit mount path has at most one selected item. A missing explicit
// item (including a bundled/default mount at that path) is its own choice.
export function partitionExactMounts(compiled, restrictions, workers, preferredPath, jobs = workers) {
  if (!Number.isSafeInteger(workers) || workers < 1 || workers > 16) throw Error('Invalid worker count');
  if (!Number.isSafeInteger(jobs) || jobs < workers || jobs > 128) throw Error('Invalid partition count');
  const paths = new Map();
  for (const {path, item, value} of compiled.players.values()) {
    if (path.includes('/') || typeof value !== 'string' || restrictions.get(value) === 0) continue;
    if (!paths.has(path)) paths.set(path, []);
    paths.get(path).push(item);
  }
  const roots = [...paths].sort(([a, av], [b, bv]) => bv.length - av.length || a.localeCompare(b));
  const [path, items] = paths.get(preferredPath)?.length >= workers - 1 ? [preferredPath, paths.get(preferredPath)]
    : paths.get('2')?.length >= 2 ? ['2', paths.get('2')] : roots[0] ?? [];
  if (!items || jobs === 1) return [{id: 0, path: null, choices: []}];
  const choices = [null, ...items.sort()];
  const secondary = roots.find(([other]) => other === '3' && other !== path) ??
    roots.find(([other]) => other !== path);
  if (jobs > workers && choices.length < jobs && secondary) {
    const [secondaryPath, items] = secondary;
    const secondaryChoices = [null, ...items.sort()];
    const count = Math.min(jobs, choices.length * secondaryChoices.length);
    return choices.flatMap((item, i) => {
      const splits = Math.floor(count / choices.length) + Number(i < count % choices.length);
      return Array.from({length: splits}, (_, j) => splits === 1 ? {path, choices: [item]}
        : {path, choices: [item], secondary_path: secondaryPath,
          secondary_choices: secondaryChoices.filter((_, index) => index % splits === j)});
    }).map((part, id) => ({id, ...part}));
  }
  if (choices.length < workers && secondary) {
    const [secondaryPath, secondaryItems] = secondary;
    const extra = Math.min(workers - choices.length + 1, secondaryItems.length + 1);
    const partitions = choices.slice(1).map(item => ({path, choices: [item]}));
    const subdivisions = Array.from({length: extra}, () =>
      ({path, choices: [null], secondary_path: secondaryPath, secondary_choices: []}));
    [null, ...secondaryItems.sort()].forEach((item, index) => subdivisions[index % extra].secondary_choices.push(item));
    return [...subdivisions, ...partitions].map((partition, id) => ({id, ...partition}));
  }
  const partitions = Array.from({length: Math.min(jobs, choices.length)},
    (_, id) => ({id, path, choices: []}));
  choices.forEach((item, index) => partitions[index % partitions.length].choices.push(item));
  return partitions;
}

export function validateExactMountPartitions(compiled, restrictions, partitions) {
  const path = partitions[0]?.path;
  const ids = new Set(partitions.map(part => part.id));
  if (path === null && partitions.length === 1 && partitions[0].choices.length === 0) return;
  if (!path || path.includes('/') || ids.size !== partitions.length ||
      partitions.some(part => part.path !== path || !part.choices.length)) {
    throw Error('Expected disjoint exact ordinary partitions');
  }
  const options = path => [null, ...[...compiled.players.values()]
    .filter(player => player.path === path && typeof player.value === 'string' && restrictions.get(player.value) !== 0)
    .map(player => player.item)];
  const cover = (available, listed) => listed.length === available.length && new Set(listed).size === available.length &&
      available.every(item => listed.includes(item));
  const subdivided = partitions.filter(part => part.secondary_path !== undefined);
  const listed = partitions.filter(part => part.secondary_path === undefined).flatMap(part => part.choices);
  if (subdivided.length) {
    const secondary = subdivided[0].secondary_path;
    if (secondary === path || secondary.includes('/') || subdivided.some(part =>
      part.secondary_path !== secondary || part.choices.length !== 1 || !part.secondary_choices?.length)) {
      throw Error('Incomplete exact ordinary subdivision coverage');
    }
    const secondaryOptions = options(secondary);
    for (const choice of new Set(subdivided.map(part => part.choices[0]))) {
      if (!cover(secondaryOptions, subdivided.filter(part => part.choices[0] === choice)
        .flatMap(part => part.secondary_choices))) throw Error('Incomplete exact ordinary subdivision coverage');
      listed.push(choice);
    }
  }
  if (!cover(options(path), listed)) throw Error('Incomplete exact ordinary partition coverage');
}

function restrictPath(compiled, restrictions, path, items) {
  const choices = new Set(items);
  const variables = [...compiled.players.values()].filter(player =>
    player.path === path && typeof player.value === 'string');
  const allowed = variables.filter(({item, value}) => choices.has(item) && restrictions.get(value) !== 0);
  if (!choices.size || choices.size !== allowed.length + Number(choices.has(null))) {
    throw Error('Invalid exact ordinary partition');
  }
  const result = new Map(restrictions);
  for (const {item, value} of variables) if (!choices.has(item)) result.set(value, 0);
  if (!choices.has(null)) {
    // Without this constraint, every partition would include the null branch.
    compiled.model.constrain(compiled.model.add(...allowed.map(({value}) => value)), '>=', 1, 'exact_partition');
  }
  return result;
}

export function restrictExactMountPartition(compiled, restrictions, partition) {
  if (!partition || partition.path === null) return restrictions;
  const primary = restrictPath(compiled, restrictions, partition.path, partition.choices);
  return partition.secondary_path === undefined ? primary :
    restrictPath(compiled, primary, partition.secondary_path, partition.secondary_choices);
}

export function exactMountPartitionContains(partition, config) {
  if (!partition || partition.path === null) return true;
  const itemAt = path => config.find(row => row.slotPath === path)?.itemId ?? null;
  return partition.choices.includes(itemAt(partition.path)) && (partition.secondary_path === undefined ||
    partition.secondary_choices.includes(itemAt(partition.secondary_path)));
}
