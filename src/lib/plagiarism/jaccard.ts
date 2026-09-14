export function jaccard(
  a: Iterable<string | number>,
  b: Iterable<string | number>,
): number {
  const x = new Set(a),
    y = new Set(b);
  const union = new Set([...x, ...y]);
  return union.size ? [...x].filter((v) => y.has(v)).length / union.size : 0;
}
