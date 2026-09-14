import "server-only";
import { adminDb } from "@/lib/supabase/admin";
import { repositorySearch } from "@/lib/plagiarism/repository-search";
import { matchingSpans } from "@/lib/plagiarism/matching-spans";
import { scores, calculateScore } from "@/lib/plagiarism/score";
import { tokenize } from "@/lib/plagiarism/tokenize";
import { referenceStart } from "@/lib/documents/section-detector";
import { selectQueries } from "@/lib/search/query-selector";
import { webProvider } from "@/lib/search/web/provider";
import { searchOpenAlex } from "@/lib/search/academic/openalex";
import { retrieveSource } from "@/lib/search/source-content";
import { analyseMatches } from "@/lib/ai/deepseek";
import { extractDocument } from "@/lib/documents/extract-document";
import { limit } from "@/lib/config";
import type { Match, Source } from "@/lib/plagiarism/types";
import type { ScanStatus } from "@/types";
export async function runScan(id: string) {
  const db = adminDb();
  const warnings: string[] = [];
  const heartbeat = setInterval(() => {
    void db
      .from("plagiarism_scans")
      .update({ heartbeat_at: new Date().toISOString() })
      .eq("id", id)
      .then(() => {});
  }, 15000);
  const stage = async (
    status: ScanStatus,
    extra: Record<string, unknown> = {},
  ) => {
    const { error } = await db
      .from("plagiarism_scans")
      .update({ status, heartbeat_at: new Date().toISOString(), ...extra })
      .eq("id", id);
    if (error) throw new Error("Could not save scan progress.");
  };
  try {
    const { data: scan, error } = await db
      .from("plagiarism_scans")
      .select("*,thesis:theses(*)")
      .eq("id", id)
      .single();
    if (error || !scan?.thesis) throw new Error("Thesis unavailable.");
    const t = scan.thesis;
    let text = t.extracted_text as string;
    if (!text) {
      const { data: file } = await db.storage
        .from("theses")
        .download(t.document_path);
      if (!file) throw new Error("Document unavailable.");
      text = (await extractDocument(Buffer.from(await file.arrayBuffer())))
        .text;
    }
    const { data: settings, error: settingError } = await db
      .from("system_settings")
      .select("*")
      .eq("id", true)
      .single();
    if (settingError) throw new Error("Institution settings unavailable.");
    await db.from("scan_sources").delete().eq("scan_id", id);
    const tokens = tokenize(text),
      eligible = tokenize(text.slice(0, referenceStart(text))).length;
    let sources: Source[] = [];
    await stage("SEARCHING_REPOSITORY");
    const repository = await repositorySearch(text, t.id);
    if (repository.truncated)
      warnings.push(
        "Repository candidate limit reached; coverage may be incomplete.",
      );
    sources = repository.sources.map((s) => ({
      ...s,
      matches: matchingSpans(text, s.text || "", "REPOSITORY"),
    }));
    const internal = sources.flatMap((s) => s.matches || []);
    const queries = selectQueries(
      text,
      limit("MAX_WEB_SEARCH_QUERIES_PER_SCAN", 15, 15),
      internal,
    );
    const seen = new Set<string>();
    await stage("SEARCHING_WEB");
    if (settings.external_search_enabled) {
      try {
        const provider = webProvider();
        for (const q of queries) {
          const results = await provider.search(q);
          for (const r of results) {
            if (seen.has(r.url)) continue;
            seen.add(r.url);
            sources.push(
              await retrieveSource({
                source_type: "WEB",
                source_title: r.title,
                source_url: r.url,
                text: r.text,
                metadata: {
                  provider: provider.name,
                  coverage: "Comparison based on search snippet",
                },
              }),
            );
          }
        }
      } catch (e) {
        warnings.push(
          (e as Error).message + " Web checking may be incomplete.",
        );
      }
    } else warnings.push("Public web search was disabled by your institution.");
    await stage("SEARCHING_ACADEMIC");
    if (settings.academic_search_enabled) {
      try {
        const academicQueries = [
          ...new Set([
            t.title,
            ...selectQueries(
              text,
              limit("MAX_ACADEMIC_SEARCH_QUERIES_PER_SCAN", 10, 10),
              internal,
            ),
          ]),
        ].slice(0, limit("MAX_ACADEMIC_SEARCH_QUERIES_PER_SCAN", 10, 10));
        for (const q of academicQueries) {
          for (const s of await searchOpenAlex(q)) {
            const key = s.doi || s.source_url || s.source_title;
            if (seen.has(key)) continue;
            seen.add(key);
            sources.push(await retrieveSource(s));
          }
        }
      } catch (e) {
        warnings.push(
          (e as Error).message + " Academic checking may be incomplete.",
        );
      }
    } else
      warnings.push("Academic source search was disabled by your institution.");
    await stage("COMPARING");
    sources = sources.map((s) => ({
      ...s,
      matches: s.matches || matchingSpans(text, s.text || "", s.source_type),
    }));
    const matches = sources.flatMap((s) => s.matches || []);
    const score = scores(tokens.length, matches, eligible);
    const useful = sources.filter(
      (s) => s.matches?.length || s.source_type !== "REPOSITORY",
    );
    await stage("AI_ANALYSIS", {
      overall_similarity: score.score,
      ...score,
      score: undefined,
      total_sources: useful.length,
      total_matches: matches.length,
      warnings,
    });
    let aiStatus = "NOT_NEEDED";
    if (matches.length) {
      try {
        const ranked = [...matches]
          .filter((m) => !m.excluded)
          .sort((a, b) => b.end - b.start - (a.end - a.start));
        for (const g of await analyseMatches(ranked)) {
          Object.assign(ranked[g.index], {
            ai_classification: g.classification,
            ai_explanation: g.explanation,
            recommendation: g.recommendation,
            citation_concern: g.citation_concern,
          });
        }
        aiStatus = "AVAILABLE";
      } catch {
        aiStatus = "UNAVAILABLE";
        warnings.push(
          "AI guidance is unavailable. Deterministic results are preserved; you can retry guidance separately.",
        );
      }
    }
    for (const source of useful) {
      const { text: sourceText, matches: sourceMatches, ...record } = source;
      void sourceText;
      const { data: s, error } = await db
        .from("scan_sources")
        .insert({
          ...record,
          scan_id: id,
          similarity_score: calculateScore(
            tokens.length,
            sourceMatches || [],
            eligible,
          ).score,
        })
        .select("id")
        .single();
      if (error) throw new Error("Could not save source results.");
      if (sourceMatches?.length) {
        const rows = sourceMatches.map((m) => ({
          scan_id: id,
          source_id: s.id,
          submitted_text: m.submitted_text.slice(0, 3000),
          source_text: m.source_text.slice(0, 3000),
          similarity_score: m.similarity_score,
          match_type: m.match_type,
          start_position: m.start_position,
          end_position: m.end_position,
          start_word: m.start,
          end_word: m.end,
          is_quoted: m.is_quoted,
          is_cited: m.is_cited,
          in_references: m.in_references,
          excluded_from_score: m.excluded || false,
          ai_classification: m.ai_classification,
          ai_explanation: m.ai_explanation,
          citation_concern: m.citation_concern,
          recommendation: m.recommendation,
        }));
        for (let offset = 0; offset < rows.length; offset += 100) {
          const { error } = await db
            .from("similarity_matches")
            .insert(rows.slice(offset, offset + 100));
          if (error) throw new Error("Could not save matching passages.");
        }
      }
    }
    await stage("COMPLETED", {
      warnings,
      ai_status: aiStatus,
      completed_at: new Date().toISOString(),
    });
  } catch (e) {
    await db
      .from("plagiarism_scans")
      .update({
        status: "FAILED",
        error_message:
          e instanceof Error ? e.message : "Scan failed. Please retry.",
        warnings,
        completed_at: new Date().toISOString(),
      })
      .eq("id", id);
  } finally {
    clearInterval(heartbeat);
  }
}
export async function retryGuidance(id: string) {
  const db = adminDb();
  const { data, error } = await db
    .from("similarity_matches")
    .select("*")
    .eq("scan_id", id)
    .eq("excluded_from_score", false)
    .order("similarity_score", { ascending: false })
    .limit(20);
  if (error) throw new Error("Matches unavailable.");
  const rows = data || [];
  const matches = rows.map((m) => ({
    ...m,
    start: m.start_word,
    end: m.end_word,
  })) as Match[];
  for (const g of await analyseMatches(matches)) {
    const { error } = await db
      .from("similarity_matches")
      .update({
        ai_classification: g.classification,
        ai_explanation: g.explanation,
        citation_concern: g.citation_concern,
        recommendation: g.recommendation,
      })
      .eq("id", rows[g.index].id);
    if (error) throw new Error("Could not save AI guidance.");
  }
  await db
    .from("plagiarism_scans")
    .update({ ai_status: "AVAILABLE" })
    .eq("id", id);
}
