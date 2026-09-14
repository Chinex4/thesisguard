import { Upload } from "tus-js-client";
import { UploadError, uploadFailure } from "./errors";
export interface UploadTicket {
  path: string;
  token: string;
  endpoint: string;
}
export async function validatePdf(file: File, maxMb: number) {
  if (file.size > maxMb * 1024 * 1024) throw new UploadError("TOO_LARGE");
  if (
    !/\.pdf$/i.test(file.name) ||
    file.size < 8 ||
    new TextDecoder().decode(await file.slice(0, 5).arrayBuffer()) !== "%PDF-"
  )
    throw new UploadError("INVALID_PDF");
}
export async function uploadApi<T>(
  url: string,
  body: unknown,
  method = "POST",
  signal?: AbortSignal,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      method,
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(300000)])
        : AbortSignal.timeout(300000),
    });
  } catch (error) {
    throw new UploadError(
      error instanceof Error && error.name === "TimeoutError"
        ? "TIMEOUT"
        : error instanceof Error && error.name === "AbortError"
          ? "CANCELLED"
          : "NETWORK",
    );
  }
  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new UploadError("SERVER", response.status);
  }
  if (!response.ok) throw uploadFailure(response.status, data);
  return data as T;
}
/** A single file/ticket retains its TUS upload URL in memory for safe retry. */
export class PdfTransfer {
  private task?: Upload;
  private reject?: (error: UploadError) => void;
  uploaded = false;
  constructor(
    readonly file: File,
    readonly ticket: UploadTicket,
  ) {}
  start(onProgress: (percent: number) => void): Promise<void> {
    if (this.uploaded) return Promise.resolve();
    return new Promise((resolve, reject) => {
      let timer: ReturnType<typeof setTimeout>;
      const fail = (error: UploadError) => {
        clearTimeout(timer);
        reject(error);
      };
      const resetDeadline = () => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          void this.task?.abort();
          fail(new UploadError("TIMEOUT"));
        }, 120000);
      };
      this.reject = fail;
      resetDeadline();
      const onError = (error: Error) => {
        const response =
          "originalResponse" in error
            ? (
                error as {
                  originalResponse?: { getStatus(): number; getBody(): string };
                }
              ).originalResponse
            : undefined;
        let data: unknown = {};
        try {
          data = JSON.parse(response?.getBody() || "{}");
        } catch {
          /* Never display raw storage responses. */
        }
        fail(uploadFailure(response?.getStatus() || 0, data, true));
      };
      const callbacks = {
        onError,
        onProgress: (sent: number, total: number) => {
          resetDeadline();
          onProgress(Math.min(99, Math.round((sent / total) * 100)));
        },
        onSuccess: () => {
          clearTimeout(timer);
          this.uploaded = true;
          onProgress(100);
          resolve();
        },
      };
      if (!this.task)
        this.task = new Upload(this.file, {
          endpoint: this.ticket.endpoint,
          headers: { "x-signature": this.ticket.token },
          metadata: {
            bucketName: "theses",
            objectName: this.ticket.path,
            contentType: "application/pdf",
            cacheControl: "3600",
          },
          chunkSize: 6 * 1024 * 1024,
          retryDelays: [0, 1000, 3000, 5000],
          onShouldRetry: (error) => {
            const status = error.originalResponse?.getStatus() || 0;
            return (
              status === 0 || status === 408 || status === 429 || status >= 500
            );
          },
          uploadDataDuringCreation: true,
          storeFingerprintForResuming: false,
          removeFingerprintOnSuccess: true,
          ...callbacks,
        });
      else Object.assign(this.task.options, callbacks);
      this.task.start();
    });
  }
  async cancel() {
    await this.task?.abort();
    this.reject?.(new UploadError("CANCELLED"));
  }
}
