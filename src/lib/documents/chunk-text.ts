import { tokenize } from "@/lib/plagiarism/tokenize";
import { fingerprints } from "@/lib/plagiarism/fingerprint";
import { normalizeText } from "./normalize-text";
export function chunkText(text: string, size = 120, overlap = 30) {
  if (size <= overlap || overlap < 0) throw new Error("Invalid chunk size");
  const tokens = tokenize(text);
  const chunks = [];
  for (let i = 0; i < tokens.length; i += size - overlap) {
    const part = tokens.slice(i, i + size);
    if (part.length < 8) continue;
    const original = text.slice(part[0].start, part.at(-1)!.end);
    chunks.push({
      chunk_index: chunks.length,
      original_text: original,
      normalized_text: normalizeText(original),
      token_count: part.length,
      fingerprint_data: fingerprints(part.map((t) => t.value)),
      start_word: i,
    });
  }
  return chunks;
}
