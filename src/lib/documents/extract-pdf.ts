import "server-only";
export async function extractPdf(buffer: Buffer): Promise<string> {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: buffer });
  try {
    const info = await parser.getInfo();
    if (info.total > 1000) throw new Error("PDF exceeds 1,000 pages.");
    return (await parser.getText()).text;
  } finally {
    await parser.destroy();
  }
}
