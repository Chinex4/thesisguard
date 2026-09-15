import "server-only";
import type { Match } from "@/lib/plagiarism/types";

export interface GuidanceResult {
  index: number;
  classification: string;
  explanation: string;
  citation_concern: string;
  recommendation: string;
}

/**
 * AI guidance is intentionally disabled for now.
 *
 * The core similarity engine does not depend on this function: repository,
 * web and academic searching, match detection, scoring and report generation
 * continue to run normally. Returning an empty, explicitly typed result keeps
 * the scan pipeline and report UI working without any external AI provider.
 */
export async function analyseMatches(
  _matches: Match[],
): Promise<GuidanceResult[]> {
  return [];
}
