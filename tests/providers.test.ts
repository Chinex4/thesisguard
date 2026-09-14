import { afterEach, describe, it, expect, vi } from "vitest";
import { tavily } from "@/lib/search/web/tavily";
import { brave } from "@/lib/search/web/brave";
import { webProvider } from "@/lib/search/web/provider";
import {
  searchOpenAlex,
  reconstructAbstract,
} from "@/lib/search/academic/openalex";
import { analyseMatches } from "@/lib/ai/deepseek";
import { matchingSpans } from "@/lib/plagiarism/matching-spans";
import { isPublicAddress, validateUrl } from "@/lib/security/safe-fetch";
import { providerJson } from "@/lib/search/http";
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
describe("provider contracts (no real API requests)", () => {
  it("defaults to Tavily and does not require Brave credentials", () => {
    vi.stubEnv("WEB_SEARCH_PROVIDER", "");
    expect(webProvider().name).toBe("Tavily");
  });
  it("uses Tavily basic search and labels snippets", async () => {
    vi.stubEnv("TAVILY_API_KEY", "unit-test-only");
    const fetch = vi.fn().mockResolvedValue(
      Response.json({
        results: [
          {
            title: "Paper",
            url: "https://example.org/paper",
            content: "Actual returned excerpt",
          },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetch);
    const result = await tavily.search("distinctive words");
    expect(result[0].coverage).toBe("snippet");
    expect(JSON.parse(fetch.mock.calls[0][1].body).search_depth).toBe("basic");
  });
  it("reports selected Brave missing-key configuration", async () => {
    vi.stubEnv("WEB_SEARCH_PROVIDER", "brave");
    vi.stubEnv("BRAVE_SEARCH_API_KEY", "");
    await expect(webProvider().search("research")).rejects.toThrow(
      "BRAVE_SEARCH_API_KEY",
    );
  });
  it("parses optional Brave results", async () => {
    vi.stubEnv("BRAVE_SEARCH_API_KEY", "unit-test-only");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json({
          web: {
            results: [
              {
                title: "Public source",
                url: "https://example.org",
                description: "Returned snippet",
              },
            ],
          },
        }),
      ),
    );
    expect((await brave.search("topic"))[0].text).toBe("Returned snippet");
  });
  it("reconstructs OpenAlex abstracts and retains provenance", async () => {
    expect(reconstructAbstract({ research: [1], Original: [0] })).toBe(
      "Original research",
    );
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json({
          results: [
            {
              id: "https://openalex.org/W1",
              title: "A research work",
              publication_year: 2024,
              authorships: [],
              abstract_inverted_index: { Original: [0], research: [1] },
              open_access: { is_oa: false },
            },
          ],
        }),
      ),
    );
    const result = await searchOpenAlex("research");
    expect(result[0].text).toBe("Original research");
    expect(result[0].metadata.coverage).toBe(
      "Comparison based on available abstract",
    );
    expect(result[0].metadata.pdf_url).toBeUndefined();
  });
  it("rejects malformed external responses", async () => {
    vi.stubEnv("TAVILY_API_KEY", "unit-test-only");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(Response.json({ not_results: [] })),
    );
    await expect(tavily.search("q")).rejects.toThrow();
  });
  it("retries temporary quota errors with a bounded attempt count", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response("", { status: 429 }))
      .mockResolvedValueOnce(Response.json({ ok: true }));
    vi.stubGlobal("fetch", fetch);
    expect(await providerJson("https://example.org")).toEqual({ ok: true });
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it("validates AI JSON and ignores invented match indexes", async () => {
    vi.stubEnv("DEEPSEEK_API_KEY", "unit-test-only");
    const item = {
      index: 0,
      classification: "likely uncited overlap",
      explanation: "Review attribution.",
      citation_concern: "No detected citation.",
      recommendation: "Check the original source.",
    };
    const fetch = vi.fn().mockResolvedValue(
      Response.json({
        choices: [
          {
            message: {
              content: JSON.stringify({
                matches: [item, { ...item, index: 99 }],
              }),
            },
          },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetch);
    const text =
      "Distinctive research methods compare distributed ecological measurements across regional monitoring stations using calibrated environmental instruments.";
    const matches = matchingSpans(text, text);
    const result = await analyseMatches(matches);
    expect(result).toHaveLength(1);
    expect(matches[0].similarity_score).toBe(100);
    expect(fetch.mock.calls[0][0]).toBe(
      "https://api.deepseek.com/chat/completions",
    );
  });
  it.each([
    "127.0.0.1",
    "127.42.1.1",
    "10.1.1.1",
    "172.16.0.1",
    "192.168.1.1",
    "169.254.169.254",
    "0.0.0.0",
    "::1",
    "fc00::1",
    "fe80::1",
    "::ffff:127.0.0.1",
    "224.0.0.1",
  ])("blocks private or reserved address %s", (ip) =>
    expect(isPublicAddress(ip)).toBe(false),
  );
  it("permits public unicast addresses", () => {
    expect(isPublicAddress("8.8.8.8")).toBe(true);
    expect(isPublicAddress("2606:4700:4700::1111")).toBe(true);
  });
  it.each([
    "file:///etc/passwd",
    "http://localhost/x",
    "http://127.0.0.1/x",
    "http://[::1]/x",
    "http://example.com:3000/x",
    "https://name:password@example.com",
  ])("rejects unsafe URL %s", async (url) => {
    await expect(validateUrl(url)).rejects.toThrow();
  });
});
