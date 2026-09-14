import "server-only";
import mammoth from "mammoth";
export async function extractDocx(buffer: Buffer): Promise<string> {
  return (await mammoth.extractRawText({ buffer })).value;
}
