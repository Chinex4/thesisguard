import "server-only";
import { z } from "zod";
import { providerJson } from "../http";
import type { Source } from "@/lib/plagiarism/types";
const work = z.object({
  id: z.string(),
  title: z.string().nullable(),
  doi: z.string().nullable().optional(),
  publication_year: z.number().nullable().optional(),
  authorships: z
    .array(z.object({ author: z.object({ display_name: z.string() }) }))
    .default([]),
  abstract_inverted_index: z
    .record(z.string(), z.array(z.number()))
    .nullable()
    .optional(),
  open_access: z
    .object({ is_oa: z.boolean(), oa_url: z.string().nullable().optional() })
    .optional(),
  primary_location: z
    .object({
      landing_page_url: z.string().nullable().optional(),
      pdf_url: z.string().nullable().optional(),
      source: z.object({ display_name: z.string() }).nullable().optional(),
    })
    .nullable()
    .optional(),
});
export function reconstructAbstract(
  index: Record<string, number[]> | null | undefined,
): string {
  if (!index) return "";
  const words: string[] = [];
  for (const [word, positions] of Object.entries(index))
    for (const p of positions) if (p >= 0 && p < 50000) words[p] = word;
  return words.join(" ");
}
export async function searchOpenAlex(query: string): Promise<Source[]> {
  const url = new URL("https://api.openalex.org/works");
  url.searchParams.set("search", query);
  url.searchParams.set("per_page", "3");
  if (process.env.OPENALEX_API_KEY)
    url.searchParams.set("api_key", process.env.OPENALEX_API_KEY);
  const data = z
    .object({ results: z.array(work) })
    .parse(await providerJson(url.href));
  return data.results.map((r) => ({
    source_type: "ACADEMIC",
    source_title: r.title || "Untitled academic work",
    source_url: r.primary_location?.landing_page_url || r.doi || r.id,
    author: r.authorships.map((a) => a.author.display_name).join(", "),
    publication_year: r.publication_year || undefined,
    doi: r.doi || undefined,
    text: reconstructAbstract(r.abstract_inverted_index),
    metadata: {
      openalex_id: r.id,
      coverage: r.abstract_inverted_index
        ? "Comparison based on available abstract"
        : "Full-text verification unavailable",
      open_access: r.open_access?.is_oa || false,
      journal: r.primary_location?.source?.display_name,
      pdf_url: r.open_access?.is_oa ? r.primary_location?.pdf_url : undefined,
    },
  }));
}
