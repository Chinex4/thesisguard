export function ngrams(words: string[], n = 5): string[] {
  if (n < 1) throw new Error("n must be positive");
  return Array.from({ length: Math.max(0, words.length - n + 1) }, (_, i) =>
    words.slice(i, i + n).join(" "),
  );
}
