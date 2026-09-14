import "server-only";
import { HttpError } from "@/lib/auth/session";
export async function readJson(request: Request) {
  const max = 64 * 1024;
  if (Number(request.headers.get("content-length")) > max)
    throw new HttpError(413, "Request is too large.");
  if (!request.body) throw new HttpError(400, "A request body is required.");
  const reader = request.body.getReader();
  let size = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > max) {
        await reader.cancel();
        throw new HttpError(413, "Request is too large.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString());
  } catch {
    throw new HttpError(400, "Request must contain valid JSON.");
  }
}
