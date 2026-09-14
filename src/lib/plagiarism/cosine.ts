export function cosine(a: string[], b: string[]): number {
  const count = (v: string[]) =>
    v.reduce(
      (m, w) => m.set(w, (m.get(w) || 0) + 1),
      new Map<string, number>(),
    );
  const x = count(a),
    y = count(b);
  const dot = [...x].reduce((s, [w, n]) => s + n * (y.get(w) || 0), 0);
  const norm = (m: Map<string, number>) =>
    Math.sqrt([...m.values()].reduce((s, n) => s + n * n, 0));
  return dot / (norm(x) * norm(y) || 1);
}
