import { beforeEach, afterEach, it, expect, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  repository: vi.fn(),
  web: vi.fn(),
  academic: vi.fn(),
  ai: vi.fn(),
  db: vi.fn(),
}));
vi.mock("@/lib/supabase/admin", () => ({ adminDb: mocks.db }));
vi.mock("@/lib/plagiarism/repository-search", () => ({
  repositorySearch: mocks.repository,
}));
vi.mock("@/lib/search/web/provider", () => ({
  webProvider: () => ({ name: "Tavily", search: mocks.web }),
}));
vi.mock("@/lib/search/academic/openalex", () => ({
  searchOpenAlex: mocks.academic,
}));
vi.mock("@/lib/ai/deepseek", () => ({ analyseMatches: mocks.ai }));
vi.mock("@/lib/search/source-content", () => ({
  retrieveSource: async (s: unknown) => s,
}));
import { runScan } from "@/lib/services/scan";
const text =
  "Distributed sensor networks monitor environmental conditions through coordinated measurements across geographically separated research stations. Researchers calibrate sophisticated instruments using laboratory experiments and rigorous mathematical simulations before deploying these environmental monitoring systems.";
let updates: Record<string, unknown>[],
  savedSources: Record<string, unknown>[],
  savedMatches: Record<string, unknown>[];
beforeEach(() => {
  updates = [];
  savedSources = [];
  savedMatches = [];
  vi.stubEnv("MAX_WEB_SEARCH_QUERIES_PER_SCAN", "1");
  vi.stubEnv("MAX_ACADEMIC_SEARCH_QUERIES_PER_SCAN", "1");
  mocks.repository.mockReset().mockResolvedValue({
    sources: [
      {
        source_type: "REPOSITORY",
        source_title: "Existing thesis",
        text: text.split(".")[0] + ".",
        metadata: { coverage: "Repository" },
      },
    ],
    truncated: false,
  });
  mocks.web.mockReset().mockRejectedValue(new Error("Tavily quota reached"));
  mocks.academic.mockReset().mockResolvedValue([
    {
      source_type: "ACADEMIC",
      source_title: "Academic paper",
      source_url: "https://example.org/paper",
      text,
      metadata: { coverage: "Abstract" },
    },
  ]);
  mocks.ai.mockReset().mockRejectedValue(new Error("DeepSeek unavailable"));
  mocks.db.mockReturnValue({
    from(table: string) {
      let op = "select",
        payload: Record<string, unknown> | Record<string, unknown>[] = {};
      const chain = {
        select() {
          return chain;
        },
        eq() {
          return chain;
        },
        delete() {
          op = "delete";
          return chain;
        },
        update(v: Record<string, unknown>) {
          op = "update";
          payload = v;
          updates.push(v);
          return chain;
        },
        insert(v: Record<string, unknown> | Record<string, unknown>[]) {
          op = "insert";
          payload = v;
          return chain;
        },
        single: async () => {
          if (table === "plagiarism_scans")
            return {
              data: {
                thesis: {
                  id: "thesis",
                  title: "Sensor research",
                  extracted_text: text,
                },
              },
              error: null,
            };
          if (table === "system_settings")
            return {
              data: {
                external_search_enabled: true,
                academic_search_enabled: true,
              },
              error: null,
            };
          if (table === "scan_sources") {
            savedSources.push(payload as Record<string, unknown>);
            return {
              data: { id: "source" + savedSources.length },
              error: null,
            };
          }
          return { data: null, error: null };
        },
        then(resolve: (v: unknown) => unknown) {
          if (table === "similarity_matches" && op === "insert")
            savedMatches.push(...(payload as Record<string, unknown>[]));
          return Promise.resolve({ data: null, error: null }).then(resolve);
        },
      };
      return chain;
    },
  });
});
afterEach(() => vi.unstubAllEnvs());
it("preserves deterministic results when web and AI fail, and continues academic checks", async () => {
  await runScan("scan-id");
  expect(mocks.academic).toHaveBeenCalled();
  expect(updates.at(-1)?.status).toBe("COMPLETED");
  expect(updates.at(-1)?.ai_status).toBe("UNAVAILABLE");
  const scored = updates.find((u) => u.status === "AI_ANALYSIS");
  expect(scored?.overall_similarity).toBe(100);
  expect(scored?.matched_word_count).toBe(scored?.eligible_word_count);
  expect(savedSources).toHaveLength(2);
  expect(savedMatches.length).toBeGreaterThan(0);
  expect(updates.at(-1)?.warnings).toEqual(
    expect.arrayContaining([
      expect.stringContaining("Web checking"),
      expect.stringContaining("AI guidance"),
    ]),
  );
});
it("continues repository and web comparisons when OpenAlex is unavailable", async () => {
  mocks.web.mockResolvedValue([
    {
      url: "https://example.org/source",
      title: "Web source",
      text,
      coverage: "snippet",
    },
  ]);
  mocks.academic.mockRejectedValue(new Error("Academic quota reached"));
  mocks.ai.mockResolvedValue([]);
  await runScan("scan-id");
  expect(updates.at(-1)?.status).toBe("COMPLETED");
  expect(savedSources.some((s) => s.source_type === "WEB")).toBe(true);
  expect(updates.at(-1)?.warnings).toEqual(
    expect.arrayContaining([expect.stringContaining("Academic checking")]),
  );
});
it("records a failure when the core repository comparison fails", async () => {
  mocks.repository.mockRejectedValue(
    new Error("Repository candidate search failed."),
  );
  await runScan("scan-id");
  expect(updates.at(-1)?.status).toBe("FAILED");
  expect(updates.at(-1)?.error_message).toBe(
    "Repository candidate search failed.",
  );
  expect(mocks.ai).not.toHaveBeenCalled();
});
