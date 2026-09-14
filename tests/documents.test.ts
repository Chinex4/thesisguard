import { it, expect } from "vitest";
import { PDFDocument, StandardFonts } from "pdf-lib";
import JSZip from "jszip";
import {
  extractDocument,
  sanitizeFilename,
} from "@/lib/documents/extract-document";
import { createReportPdf } from "@/lib/reports/pdf";
import { mkdirSync, writeFileSync } from "node:fs";
import type { report } from "@/lib/services/data";
const text =
  "Research integrity requires careful attribution and transparent assessment of matching content across accessible academic sources.";
it("extracts a real PDF with Node parsing", async () => {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  pdf.addPage().drawText(text, { x: 30, y: 700, size: 9, font });
  const bytes = Buffer.from(await pdf.save());
  const result = await extractDocument(bytes);
  expect(result.kind).toBe("pdf");
  expect(result.text).toContain("Research integrity");
});
it("extracts a genuine DOCX archive", async () => {
  const zip = new JSZip();
  zip.file(
    "[Content_Types].xml",
    '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
  );
  zip.file(
    "_rels/.rels",
    '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
  );
  zip.file(
    "word/document.xml",
    '<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>' +
      text +
      "</w:t></w:r></w:p></w:body></w:document>",
  );
  const result = await extractDocument(
    await zip.generateAsync({ type: "nodebuffer" }),
  );
  expect(result.kind).toBe("docx");
  expect(result.text).toContain(text);
});
it("rejects empty, fake, corrupted and oversized files", async () => {
  await expect(extractDocument(Buffer.from(""))).rejects.toThrow("empty");
  await expect(
    extractDocument(Buffer.from("this is a fake PDF file")),
  ).rejects.toThrow("valid PDF");
  await expect(
    extractDocument(Buffer.from("%PDF-broken content")),
  ).rejects.toThrow("Unable to read");
  await expect(
    extractDocument(Buffer.alloc(1024 * 1024 + 1), 1),
  ).rejects.toThrow("upload limit");
});
it("sanitizes filenames", () =>
  expect(sanitizeFilename("../../evil name<script>.pdf")).not.toContain("/"));
it("generates a readable paginated report with source evidence and disclaimer", async () => {
  const data = {
    scan: {
      id: "report-test",
      created_at: "2026-09-08T12:00:00Z",
      completed_at: "2026-09-08T12:00:00Z",
      status: "COMPLETED",
      overall_similarity: 18,
      repository_similarity: 18,
      web_similarity: 0,
      academic_similarity: 0,
      total_sources: 1,
      total_matches: 1,
      eligible_word_count: 100,
      matched_word_count: 18,
      warnings: ["Illustrative test fixture. No live provider call was made."],
      thesis: {
        title: "Academic Integrity and Responsible Research Practices",
        student: { full_name: "Test Student", matric_number: "TEST/001" },
        department: { name: "Computer Science" },
        faculty: { name: "Science" },
      },
    },
    sources: [
      {
        source_title: "Test repository source",
        source_type: "REPOSITORY",
        similarity_score: 18,
        metadata: { coverage: "Test fixture" },
      },
    ],
    matches: [
      {
        submitted_text: text,
        source_text: text,
        match_type: "EXACT",
        similarity_score: 100,
        is_quoted: false,
        is_cited: false,
      },
    ],
  } as unknown as NonNullable<Awaited<ReturnType<typeof report>>>;
  const bytes = await createReportPdf(data);
  const parsed = await extractDocument(Buffer.from(bytes));
  expect(parsed.text).toContain("THESISGUARD");
  expect(parsed.text.replace(/\s+/g, " ")).toContain("Human academic review");
  expect(parsed.text).toContain("Test repository source");
  mkdirSync("output/pdf", { recursive: true });
  writeFileSync("output/pdf/verification-report.pdf", bytes);
});

it("rejects ZIP entries with dishonest expanded lengths before parsing", async () => {
  const zip = new JSZip();
  zip.file("[Content_Types].xml", "xml");
  zip.file("word/document.xml", "a".repeat(10000));
  const bytes = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
  });
  const central = bytes.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
  bytes.writeUInt32LE(0, central + 24);
  await expect(extractDocument(bytes)).rejects.toThrow("expanded size");
});
