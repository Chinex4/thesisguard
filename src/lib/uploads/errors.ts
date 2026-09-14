export type UploadCode =
  | "NETWORK"
  | "AUTH"
  | "TOO_LARGE"
  | "INVALID_PDF"
  | "PERMISSION"
  | "BUCKET"
  | "EXPIRED"
  | "CANCELLED"
  | "TIMEOUT"
  | "CONFLICT"
  | "SERVER";
const messages: Record<UploadCode, string> = {
  NETWORK:
    "The storage connection failed. Check your connection and retry. If it persists, check the browser Console for the network error.",
  AUTH: "Your session has expired. Sign in again before retrying.",
  TOO_LARGE: "The PDF exceeds the configured upload limit.",
  INVALID_PDF: "Choose a valid, unlocked PDF with readable text.",
  PERMISSION: "Storage denied this upload. Contact your administrator.",
  BUCKET:
    "The document storage bucket is unavailable. Contact your administrator.",
  EXPIRED:
    "The secure upload authorization expired. Choose the file again to start a new upload.",
  CANCELLED:
    "Upload cancelled. You can retry without re-entering your thesis information.",
  TIMEOUT: "The upload timed out. Check your connection and retry.",
  CONFLICT:
    "This upload is already being processed. Wait briefly and retry saving it.",
  SERVER: "The upload service could not complete this step. Please retry.",
};
export class UploadError extends Error {
  constructor(
    public code: UploadCode,
    public status = 0,
  ) {
    super(messages[code]);
  }
}
export function uploadFailure(
  status: number,
  body: unknown,
  storage = false,
): UploadError {
  const data =
    body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  if (typeof data.code === "string" && Object.hasOwn(messages, data.code))
    return new UploadError(data.code as UploadCode, status);
  const detail = [data.code, data.error, data.message]
    .filter((x) => typeof x === "string")
    .join(" ")
    .toLowerCase();
  if (/expired|invalidjwt|invalidsignature|invalid token/.test(detail))
    return new UploadError(storage ? "EXPIRED" : "AUTH", status);
  if (/bucket/.test(detail) && /not found|notfound|unavailable/.test(detail))
    return new UploadError("BUCKET", status);
  if (status === 413 || /entitytoolarge|too large|size|limit/.test(detail))
    return new UploadError("TOO_LARGE", status);
  if (status === 401)
    return new UploadError(storage ? "EXPIRED" : "AUTH", status);
  if (status === 403 || /accessdenied|permission|row.level/.test(detail))
    return new UploadError("PERMISSION", status);
  if (status === 409 || /duplicate|already exists/.test(detail))
    return new UploadError("CONFLICT", status);
  if (status === 408 || status === 504)
    return new UploadError("TIMEOUT", status);
  return new UploadError(status === 0 ? "NETWORK" : "SERVER", status);
}
export function logUploadFailure(stage: string, error: UploadError) {
  if (process.env.NODE_ENV === "development") {
    // Do not log raw exceptions: TUS errors can contain credential-bearing URLs.
    console.warn("[ThesisGuard upload]", {
      stage,
      code: error.code,
      status: error.status,
    });
  }
}
