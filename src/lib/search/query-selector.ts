import {
  sentenceSegments,
  referenceStart,
  citationFlags,
} from "@/lib/documents/section-detector";
import { tokenize } from "@/lib/plagiarism/tokenize";
import type { Span } from "@/lib/plagiarism/types";
export function selectQueries(
  text: string,
  max = 15,
  internal: Span[] = [],
): string[] {
  const tokens = tokenize(text);
  const frequency = new Map<string, number>();
  tokens.forEach((t) =>
    frequency.set(t.value, (frequency.get(t.value) || 0) + 1),
  );
  const candidates = sentenceSegments(text.slice(0, referenceStart(text)))
    .filter((s) => {
      const flags = citationFlags(
        text.slice(s.start, Math.min(text.length, s.end + 120)),
      );
      return (
        !flags.is_quoted &&
        !flags.is_cited &&
        !internal.some(
          (m) =>
            !m.excluded &&
            tokens[m.start]?.start <= s.start + 1 &&
            tokens[m.end - 1]?.end >= s.end - 1,
        )
      );
    })
    .map((s) => tokenize(s.text).map((t) => t.value))
    .filter((w) => w.length >= 12 && new Set(w).size / w.length > 0.6)
    .map((words) => ({
      q: words.slice(0, 14).join(" "),
      rank:
        words.reduce(
          (sum, w) => sum + (w.length > 5 ? 1 : 0) / (frequency.get(w) || 1),
          0,
        ) / words.length,
    }))
    .sort((a, b) => b.rank - a.rank);
  return [
    ...new Set(candidates.filter((c) => c.rank > 0.08).map((c) => c.q)),
  ].slice(0, Math.max(0, max));
}
