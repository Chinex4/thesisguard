export interface Token {
  value: string;
  start: number;
  end: number;
}
export function tokenize(text: string): Token[] {
  return Array.from(text.matchAll(/[\p{L}\p{N}][\p{L}\p{N}\p{M}]*/gu), (m) => ({
    value: m[0].normalize("NFKC").toLowerCase(),
    start: m.index!,
    end: m.index! + m[0].length,
  }));
}
