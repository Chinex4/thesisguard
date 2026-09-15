import "server-only";
import type { Match } from "@/lib/plagiarism/types";

/**
 * AI guidance is intentionally disabled for now.
 *
 * The core similarity engine does not depend on this function: repository,
 * web and academic searching, match detection, scoring and report generation
 * continue to run normally. Returning an empty result makes the scan fall
 * back to the built-in non-AI academic integrity guidance in the report UI.
 */
export async function analyseMatches(_matches: Match[]) {
  return [];
}
