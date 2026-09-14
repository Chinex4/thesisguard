import { ngrams } from "./ngrams";
import { winnowing } from "./winnowing";
export function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
export function fingerprints(words: string[], n = 5, window = 4): number[] {
  return [
    ...new Set(
      winnowing(ngrams(words, n).map(hash), window).map((f) => f.hash),
    ),
  ];
}
