import { mergeSpans } from "./matching-spans";
import type { Span, SourceType } from "./types";
export function calculateScore(
  total: number,
  spans: Span[],
  eligibleEnd = total,
) {
  const eligible = Math.max(0, Math.min(total, eligibleEnd));
  const merged = mergeSpans(
    spans.map((s) => ({
      ...s,
      start: Math.max(0, s.start),
      end: Math.min(eligible, s.end),
    })),
  );
  const matched = merged.reduce((sum, s) => sum + s.end - s.start, 0);
  return {
    eligible_word_count: eligible,
    matched_word_count: matched,
    score: eligible ? Math.round((matched / eligible) * 10000) / 100 : 0,
  };
}
export function scores(total: number, spans: Span[], eligibleEnd = total) {
  const forType = (type: SourceType) =>
    calculateScore(
      total,
      spans.filter((s) => s.sourceType === type),
      eligibleEnd,
    ).score;
  return {
    ...calculateScore(total, spans, eligibleEnd),
    repository_similarity: forType("REPOSITORY"),
    web_similarity: forType("WEB"),
    academic_similarity: forType("ACADEMIC"),
  };
}
