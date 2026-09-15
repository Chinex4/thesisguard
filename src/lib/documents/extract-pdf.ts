import "server-only";

export async function extractPdf(buffer: Buffer): Promise<string> {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: buffer });

  try {
    // Parse once. Calling getInfo() before getText() can cause otherwise readable
    // PDFs to fail during finalization, while getText() already reports total pages.
    const result = await parser.getText();
    if (result.total > 1000) throw new Error("PDF exceeds 1,000 pages.");
    return result.text;
  } finally {
    await parser.destroy();
  }
}
