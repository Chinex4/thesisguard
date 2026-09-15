import "server-only";

export async function extractPdf(buffer: Buffer): Promise<string> {
  // pdf-parse requires its worker/canvas helpers to be loaded explicitly in
  // Next.js serverless environments such as Vercel. Without this, valid PDFs
  // can fail during parsing even though their bytes are intact.
  const { CanvasFactory } = await import("pdf-parse/worker");
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: buffer, CanvasFactory });

  try {
    const result = await parser.getText();
    if (result.total > 1000) throw new Error("PDF exceeds 1,000 pages.");
    return result.text;
  } finally {
    await parser.destroy();
  }
}
