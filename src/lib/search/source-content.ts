import "server-only";
import { load } from "cheerio";
import { safeFetch } from "@/lib/security/safe-fetch";
import { extractPdf } from "@/lib/documents/extract-pdf";
import type { Source } from "@/lib/plagiarism/types";
export async function retrieveSource(source: Source): Promise<Source> {
  const url =
    source.source_type === "ACADEMIC"
      ? (source.metadata.pdf_url as string | undefined)
      : source.source_url;
  if (!url) return source;
  try {
    const fetched = await safeFetch(
      url,
      source.source_type === "ACADEMIC" ? 8_000_000 : 2_000_000,
    );
    let text: string;
    if (fetched.contentType.includes("pdf"))
      text = await extractPdf(fetched.buffer);
    else if (fetched.contentType.includes("html")) {
      const $ = load(fetched.buffer.toString());
      $("script,style,nav,footer,header,form,aside").remove();
      text = $("article,main").first().text() || $("body").text();
    } else text = fetched.buffer.toString();
    if (text.trim().length < 100) throw new Error("Insufficient text");
    return {
      ...source,
      text: text.slice(0, 150000),
      metadata: {
        ...source.metadata,
        coverage: "Comparison based on retrieved public text",
        retrieved_url: fetched.url,
      },
    };
  } catch {
    return {
      ...source,
      metadata: {
        ...source.metadata,
        verification_warning:
          "Full-text verification unavailable; comparison uses only available snippet or abstract.",
      },
    };
  }
}
