import { isLowInformation } from "./information";
import type { Span, Match, SourceType } from "./types";
import { tokenize } from "./tokenize";
import { ngrams } from "./ngrams";
import { jaccard } from "./jaccard";
import { cosine } from "./cosine";
import {
  referenceStart,
  citationFlags,
} from "@/lib/documents/section-detector";
export function mergeSpans(spans: Span[]): Span[] {
  const sorted = spans
    .filter((s) => !s.excluded && s.end > s.start)
    .map((s) => ({ ...s }))
    .sort((a, b) => a.start - b.start);
  const result: Span[] = [];
  for (const s of sorted) {
    const last = result.at(-1);
    if (last && s.start <= last.end) last.end = Math.max(last.end, s.end);
    else result.push(s);
  }
  return result;
}
export function matchingSpans(
  submitted: string,
  source: string,
  sourceType: SourceType = "REPOSITORY",
): Match[] {
  const a = tokenize(submitted),
    b = tokenize(source),
    av = a.map((t) => t.value),
    bv = b.map((t) => t.value);
  const index = new Map<string, number[]>();
  ngrams(bv, 5).forEach((g, i) => {
    const p = index.get(g) || [];
    if (p.length < 30) p.push(i);
    index.set(g, p);
  });
  const matches: Match[] = [];
  const ref = referenceStart(submitted);
  let covered = -1;
  for (let i = 0; i <= a.length - 8; i++) {
    if (i < covered) continue;
    const positions = index.get(av.slice(i, i + 5).join(" ")) || [];
    let best = 0,
      sourceStart = 0;
    for (const j of positions) {
      let length = 5;
      while (
        i + length < a.length &&
        j + length < b.length &&
        av[i + length] === bv[j + length]
      )
        length++;
      if (length > best) {
        best = length;
        sourceStart = j;
      }
    }
    if (best < 8 || isLowInformation(av.slice(i, i + best))) continue;
    const passage = submitted.slice(a[i].start, a[i + best - 1].end);
    const context = submitted.slice(
      Math.max(0, a[i].start - 120),
      Math.min(submitted.length, a[i + best - 1].end + 120),
    );
    const flags = citationFlags(context);
    const inReferences = a[i].start >= ref;
    matches.push({
      start: i,
      end: i + best,
      sourceType,
      excluded: inReferences,
      submitted_text: passage,
      source_text: source.slice(
        b[sourceStart].start,
        b[sourceStart + best - 1].end,
      ),
      similarity_score: 100,
      match_type: "EXACT",
      ...flags,
      in_references: inReferences,
      start_position: a[i].start,
      end_position: a[i + best - 1].end,
    });
    covered = i + best;
  }
  // Lexical windows require strong shared bigrams as well as vocabulary, not just topic similarity.
  for (let i = 0; i + 24 <= a.length; i += 24) {
    if (matches.some((m) => m.start < i + 24 && m.end > i)) continue;
    const x = av.slice(i, i + 32);
    const seeds = [
      ...new Set(ngrams(x, 5).flatMap((g) => index.get(g) || [])),
    ].slice(0, 12);
    for (const seed of seeds) {
      const j = Math.max(0, seed - 8),
        y = bv.slice(j, j + x.length);
      if (jaccard(ngrams(x, 2), ngrams(y, 2)) < 0.62 || cosine(x, y) < 0.85)
        continue;
      const flags = citationFlags(
        submitted.slice(
          Math.max(0, a[i].start - 80),
          a[i + x.length - 1].end + 80,
        ),
      );
      const inReferences = a[i].start >= ref;
      matches.push({
        start: i,
        end: i + x.length,
        sourceType,
        excluded: inReferences,
        submitted_text: submitted.slice(a[i].start, a[i + x.length - 1].end),
        source_text: source.slice(
          b[j].start,
          b[Math.min(b.length - 1, j + x.length - 1)].end,
        ),
        similarity_score: Math.round(cosine(x, y) * 100),
        match_type: "LEXICAL",
        ...flags,
        in_references: inReferences,
        start_position: a[i].start,
        end_position: a[i + x.length - 1].end,
      });
      break;
    }
  }
  return matches;
}
