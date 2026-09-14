import { validateDocxArchive } from "./validate-docx";
import "server-only";
import { extractPdf } from "./extract-pdf";
import { extractDocx } from "./extract-docx";
export function sanitizeFilename(name: string) {
  return (
    name
      .normalize("NFKC")
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .slice(-150) || "document"
  );
}
export function detectDocument(buffer: Buffer): "pdf" | "docx" {
  if (buffer.length < 8) throw new Error("The document is empty or invalid.");
  if (buffer.subarray(0, 5).toString() === "%PDF-") return "pdf";
  if (
    buffer.readUInt32LE(0) === 0x04034b50 &&
    buffer.includes(Buffer.from("[Content_Types].xml")) &&
    buffer.includes(Buffer.from("word/document.xml"))
  )
    return "docx";
  throw new Error("Only valid PDF and DOCX documents are supported.");
}
export async function extractDocument(buffer: Buffer, maxMb = 20) {
  if (buffer.length < 8) throw new Error("The document is empty or invalid.");
  if (buffer.length > maxMb * 1024 * 1024)
    throw new Error("The document exceeds the upload limit.");
  const kind = detectDocument(buffer);
  if (kind === "docx") validateDocxArchive(buffer);
  let text: string;
  try {
    text =
      kind === "pdf" ? await extractPdf(buffer) : await extractDocx(buffer);
  } catch {
    throw new Error(
      "Unable to read this document. It may be damaged or password protected. Upload an unlocked PDF or DOCX.",
    );
  }
  if (text.trim().length < 40)
    throw new Error(
      "No readable text was found. Scanned image PDFs need OCR before uploading.",
    );
  if (text.length > 1500000)
    throw new Error(
      "This document contains too much text. Maximum 1.5 million characters.",
    );
  return {
    text,
    kind,
    mime:
      kind === "pdf"
        ? "application/pdf"
        : "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  };
}
