export function referenceStart(text: string): number {
  const match =
    /^\s*(?:\d+[.\s]+)?(?:references|bibliography|works cited)\s*:?\s*$/im.exec(
      text,
    );
  return match?.index ?? text.length;
}
export function citationFlags(text: string) {
  return {
    is_quoted: /[“”"].{12,}[“”"]/s.test(text),
    is_cited:
      /\[[\d,\s–-]+\]|\([\p{L}][^)]{0,100}\b(?:19|20)\d{2}[a-z]?[^)]*\)|\b\p{Lu}\p{L}+\s*\((?:19|20)\d{2}\)/u.test(
        text,
      ),
  };
}
export function sentenceSegments(
  text: string,
): { text: string; start: number; end: number }[] {
  return Array.from(text.matchAll(/[^.!?\n]+(?:[.!?]+|$)/g), (m) => ({
    text: m[0],
    start: m.index!,
    end: m.index! + m[0].length,
  }));
}
