import { describe, it, expect } from "vitest";
import { normalizeText } from "@/lib/documents/normalize-text";
import { tokenize } from "@/lib/plagiarism/tokenize";
import { ngrams } from "@/lib/plagiarism/ngrams";
import { jaccard } from "@/lib/plagiarism/jaccard";
import { cosine } from "@/lib/plagiarism/cosine";
import { hash, fingerprints } from "@/lib/plagiarism/fingerprint";
import { winnowing } from "@/lib/plagiarism/winnowing";
import { matchingSpans, mergeSpans } from "@/lib/plagiarism/matching-spans";
import { calculateScore, scores } from "@/lib/plagiarism/score";
import { selectQueries } from "@/lib/search/query-selector";
import {
  referenceStart,
  citationFlags,
} from "@/lib/documents/section-detector";
import { chunkText } from "@/lib/documents/chunk-text";
const passage =
  "Distributed sensor networks monitor environmental conditions through coordinated measurements across geographically separated research stations.";
describe("preprocessing", () => {
  it("normalizes Unicode, whitespace and punctuation", () =>
    expect(normalizeText("  Ｈello,\n WORLD! café  ")).toBe(
      "hello world café",
    ));
  it("preserves original token character offsets", () => {
    const text = "An “original” café.";
    const t = tokenize(text);
    expect(t.map((x) => x.value)).toEqual(["an", "original", "café"]);
    expect(text.slice(t[1].start, t[1].end)).toBe("original");
  });
  it("creates overlapping indexed chunks", () => {
    const c = chunkText(
      Array.from({ length: 250 }, (_, i) => "word" + i).join(" "),
    );
    expect(c.length).toBe(3);
    expect(c[1].start_word).toBe(90);
    expect(c[0].fingerprint_data.length).toBeGreaterThan(0);
  });
  it("finds reference headings but not prose mentions", () => {
    expect(referenceStart("We use references in this discussion.")).toBe(37);
    expect(referenceStart("Research\nReferences\nSmith")).toBe(9);
  });
  it("labels quotations and multiple citation styles", () => {
    expect(
      citationFlags("“a sufficiently long quotation” (Smith, 2024)"),
    ).toEqual({ is_quoted: true, is_cited: true });
    expect(citationFlags("A claim [12].").is_cited).toBe(true);
    expect(citationFlags("Smith (2024) describes it.").is_cited).toBe(true);
  });
});
describe("deterministic algorithms", () => {
  it("creates n-grams including short input", () => {
    expect(ngrams(["a", "b", "c"], 2)).toEqual(["a b", "b c"]);
    expect(ngrams(["a"], 3)).toEqual([]);
  });
  it("calculates set Jaccard", () => {
    expect(jaccard(["a", "b"], ["b", "c"])).toBeCloseTo(1 / 3);
    expect(jaccard([], [])).toBe(0);
  });
  it("calculates term-frequency cosine", () => {
    expect(cosine(["a", "a", "b"], ["a", "a", "b"])).toBeCloseTo(1);
    expect(cosine(["a"], ["b"])).toBe(0);
    expect(cosine([], [])).toBe(0);
  });
  it("hashes deterministically and produces document fingerprints", () => {
    expect(hash("hello")).toBe(1335831723);
    const words = tokenize(passage).map((t) => t.value);
    expect(fingerprints(words)).toEqual(fingerprints(words));
    expect(fingerprints(words).length).toBeGreaterThan(0);
  });
  it("winnows using the rightmost minimum and deduplicates selection", () => {
    expect(winnowing([4, 2, 2, 5], 3)).toEqual([{ hash: 2, index: 2 }]);
    expect(winnowing([8, 3], 4)).toEqual([{ hash: 3, index: 1 }]);
    expect(winnowing([], 4)).toEqual([]);
  });
  it("scores identical meaningful passages at 100", () => {
    const m = matchingSpans(passage, passage);
    expect(calculateScore(tokenize(passage).length, m).score).toBe(100);
  });
  it("scores unrelated passages at zero", () => {
    expect(
      matchingSpans(
        passage,
        "Historical sculpture evolved through artistic traditions originating in ancient marble workshops and temples.",
      ),
    ).toEqual([]);
  });
  it("does not count topic vocabulary alone as overlap", () => {
    expect(
      matchingSpans(
        "Research stations monitor sensor networks across environmental conditions through distributed measurements coordinated geographically separated",
        "Geographically separated measurements across sensor conditions through environmental distributed stations research coordinated monitor networks",
      ),
    ).toEqual([]);
  });
  it("merges contained and overlapping spans without mutation", () => {
    const spans = [
      { start: 10, end: 20 },
      { start: 5, end: 15 },
      { start: 8, end: 9 },
      { start: 25, end: 30 },
    ];
    expect(mergeSpans(spans)).toEqual([
      { start: 5, end: 20 },
      { start: 25, end: 30 },
    ]);
    expect(spans[0].start).toBe(10);
  });
  it("deduplicates overlap across all source categories", () => {
    const s = scores(100, [
      { start: 0, end: 30, sourceType: "REPOSITORY" },
      { start: 20, end: 40, sourceType: "WEB" },
      { start: 0, end: 10, sourceType: "ACADEMIC" },
    ]);
    expect(s.score).toBe(40);
    expect(s.repository_similarity).toBe(30);
    expect(s.web_similarity).toBe(20);
  });
  it("excluded bibliography and excluded matches do not inflate scores", () => {
    const text = "This is original work.\nReferences\n" + passage;
    const m = matchingSpans(text, passage);
    expect(m[0].in_references).toBe(true);
    expect(
      calculateScore(
        tokenize(text).length,
        m,
        tokenize(text.slice(0, referenceStart(text))).length,
      ).score,
    ).toBe(0);
    expect(
      calculateScore(100, [{ start: 0, end: 50, excluded: true }]).score,
    ).toBe(0);
  });
  it("clips spans to eligible boundaries and handles an empty document", () => {
    expect(calculateScore(10, [{ start: -10, end: 20 }], 5).score).toBe(100);
    expect(calculateScore(0, [{ start: 0, end: 10 }]).score).toBe(0);
  });
  it("labels cited overlap without automatically excluding it", () => {
    const m = matchingSpans("“" + passage + "” (Smith, 2024)", passage);
    expect(m[0].is_quoted).toBe(true);
    expect(m[0].is_cited).toBe(true);
    expect(m[0].excluded).toBe(false);
  });
  it("selects bounded distinctive queries without references, citations or duplicate calls", () => {
    const text = passage + " " + passage + "\nReferences\n" + passage;
    expect(selectQueries(text, 15)).toHaveLength(1);
    expect(selectQueries("“" + passage + "” (Smith, 2024)", 15)).toEqual([]);
    expect(selectQueries(passage, 0)).toEqual([]);
    expect(
      selectQueries(passage, 15, [{ start: 0, end: tokenize(passage).length }]),
    ).toEqual([]);
  });
});

it("preserves decomposed Unicode token offsets while comparing canonical words", () => {
  const original = "cafe\u0301 research";
  expect(tokenize(original)[0]).toEqual({ value: "café", start: 0, end: 5 });
});
it("does not turn generic academic boilerplate into a meaningful match", () => {
  const generic =
    "the purpose of this study and this research is to present the aims and objectives of this thesis";
  expect(matchingSpans(generic, generic)).toEqual([]);
});
