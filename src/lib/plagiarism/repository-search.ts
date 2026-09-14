import "server-only";
import { adminDb } from "@/lib/supabase/admin";
import { fingerprints } from "./fingerprint";
import { tokenize } from "./tokenize";
import type { Source } from "./types";
export async function repositorySearch(
  text: string,
  excludeId: string,
): Promise<{ sources: Source[]; truncated: boolean }> {
  const db = adminDb();
  const fp = fingerprints(tokenize(text).map((t) => t.value));
  const found = new Map<string, { thesis_id: string; original_text: string }>();
  let truncated = false;
  for (let offset = 0; offset < fp.length; offset += 1000) {
    const { data, error } = await db.rpc("repository_candidates", {
      p_fingerprints: fp.slice(offset, offset + 1000),
      p_exclude: excludeId,
    });
    if (error) throw new Error("Repository candidate search failed.");
    if (data?.length === 400) truncated = true;
    for (const c of data || []) found.set(c.id, c);
  }
  const ids = [...new Set([...found.values()].map((c) => c.thesis_id))];
  if (!ids.length) return { sources: [], truncated };
  const { data, error } = await db
    .from("theses")
    .select(
      "id,title,academic_year,extracted_text,student:profiles!theses_student_id_fkey(full_name)",
    )
    .in("id", ids);
  if (error) throw new Error("Repository metadata unavailable.");
  return {
    truncated,
    sources: (data || []).map((t) => ({
      source_type: "REPOSITORY",
      source_title: t.title,
      repository_thesis_id: t.id,
      publication_year: t.academic_year,
      author: (t.student as unknown as { full_name: string })?.full_name,
      text: t.extracted_text || "",
      metadata: { coverage: "Comparison based on indexed repository passages" },
    })),
  };
}
