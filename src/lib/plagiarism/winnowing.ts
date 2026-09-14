export function winnowing(
  hashes: number[],
  window = 4,
): { hash: number; index: number }[] {
  if (window < 1) throw new Error("Window must be positive");
  if (!hashes.length) return [];
  const size = Math.min(window, hashes.length);
  const result: { hash: number; index: number }[] = [];
  let previous = -1;
  for (let i = 0; i <= hashes.length - size; i++) {
    let best = i;
    for (let j = i; j < i + size; j++) if (hashes[j] <= hashes[best]) best = j;
    if (best !== previous) {
      result.push({ hash: hashes[best], index: best });
      previous = best;
    }
  }
  return result;
}
