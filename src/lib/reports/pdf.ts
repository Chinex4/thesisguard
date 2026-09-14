import "server-only";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { DISCLAIMER } from "@/types";
import type { report } from "@/lib/services/data";
export async function createReportPdf(
  data: NonNullable<Awaited<ReturnType<typeof report>>>,
) {
  const doc = await PDFDocument.create();
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  let page = doc.addPage([595, 842]),
    y = 770;
  const clean = (s: unknown) =>
    String(s ?? "—")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[–—]/g, "-")
      .replace(/[‘’]/g, "'")
      .replace(/[“”]/g, '"')
      .replace(/[^\x20-\x7E\n]/g, "?");
  const line = (text: unknown, size = 10, heavy = false) => {
    const words = clean(text)
      .split(/\s+/)
      .flatMap((word) => word.match(/.{1,55}/g) || []);
    let row = "";
    const font = heavy ? bold : regular;
    const draw = () => {
      if (y < 65) {
        page = doc.addPage([595, 842]);
        y = 770;
      }
      page.drawText(row, {
        x: 48,
        y,
        size,
        font,
        color: rgb(0.12, 0.18, 0.26),
      });
      y -= size + 6;
    };
    for (const word of words) {
      if (font.widthOfTextAtSize(row + " " + word, size) > 490 && row) {
        draw();
        row = "";
      }
      row += (row ? " " : "") + word;
    }
    if (row) draw();
    y -= 5;
  };
  const { scan, sources, matches } = data;
  line("THESISGUARD", 20, true);
  line("Academic similarity report", 12);
  line(scan.thesis?.title, 17, true);
  line("Student: " + (scan.thesis?.student?.full_name || "Unavailable"));
  line(
    "Matriculation: " + (scan.thesis?.student?.matric_number || "Not supplied"),
  );
  line(
    "Faculty: " +
      (scan.thesis?.faculty?.name || "") +
      " | Department: " +
      (scan.thesis?.department?.name || ""),
  );
  line(
    "Checked: " +
      new Date(scan.completed_at || scan.created_at).toISOString().slice(0, 10),
  );
  line("Overall similarity: " + scan.overall_similarity + "%", 18, true);
  line(
    "Repository " +
      scan.repository_similarity +
      "% | Public web " +
      scan.web_similarity +
      "% | Academic " +
      scan.academic_similarity +
      "%",
  );
  line(
    scan.matched_word_count +
      " matched eligible words of " +
      scan.eligible_word_count +
      ". " +
      scan.total_sources +
      " sources; " +
      scan.total_matches +
      " matching passages.",
  );
  line(DISCLAIMER);
  for (const warning of scan.warnings || []) line("Coverage note: " + warning);
  line("Sources", 14, true);
  for (const [i, s] of sources.entries()) {
    line(i + 1 + ". " + s.source_title, 11, true);
    line(
      s.source_type +
        " | " +
        (s.author || "Author unavailable") +
        " | " +
        (s.publication_year || "Year unavailable") +
        " | contribution " +
        s.similarity_score +
        "%",
    );
    if (s.source_url) line(s.source_url, 9);
    if (s.doi) line("DOI: " + s.doi, 9);
    line(s.metadata?.coverage || "Available text only", 9);
  }
  line("Selected matching passages (maximum 20)", 14, true);
  for (const m of matches.slice(0, 20)) {
    line(
      m.match_type +
        " | strength " +
        m.similarity_score +
        "%" +
        (m.excluded_from_score ? " | Excluded reference text" : ""),
      10,
      true,
    );
    line("Submitted: " + m.submitted_text.slice(0, 450));
    line("Source: " + m.source_text.slice(0, 450));
    line(
      "Quotation detected: " +
        (m.is_quoted ? "yes" : "no") +
        " | Citation detected: " +
        (m.is_cited ? "yes" : "no"),
    );
    if (m.ai_classification)
      line(m.ai_classification + ": " + m.ai_explanation);
    line(
      "Guidance: " +
        (m.recommendation ||
          "Review the original source, check attribution, and use quotation marks for verbatim wording."),
    );
  }
  const pages = doc.getPages();
  pages.forEach((p, i) =>
    p.drawText(
      "ThesisGuard | " + scan.id + " | " + (i + 1) + " / " + pages.length,
      { x: 48, y: 30, font: regular, size: 8, color: rgb(0.4, 0.45, 0.5) },
    ),
  );
  return doc.save();
}
