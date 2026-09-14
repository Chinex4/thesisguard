import { beforeEach, it, expect, vi } from "vitest";
import type { UploadOptions } from "tus-js-client";
const state = vi.hoisted(() => ({ options: {} as UploadOptions, starts: 0 }));
vi.mock("tus-js-client", () => ({
  Upload: class {
    options: UploadOptions;
    constructor(_file: File, options: UploadOptions) {
      this.options = options;
      state.options = options;
    }
    start() {
      state.starts++;
    }
    async abort() {}
  },
}));
import { PdfTransfer, validatePdf, uploadApi } from "@/lib/uploads/client";
import {
  uploadFailure,
  logUploadFailure,
  UploadError,
} from "@/lib/uploads/errors";
const file = new File(["%PDF-1.7 test document"], "thesis.pdf", {
  type: "application/pdf",
});
const ticket = {
  path: "owner/staging/id/thesis.pdf",
  token: "secret-test-token",
  endpoint: "https://storage.example.test/storage/v1/upload/resumable",
};
beforeEach(() => {
  state.starts = 0;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
it("accepts PDF bytes and rejects renamed, empty, DOCX and oversized files", async () => {
  await expect(validatePdf(file, 20)).resolves.toBeUndefined();
  for (const invalid of [
    new File(["not a pdf"], "test.pdf"),
    new File([], "test.pdf"),
    new File(["%PDF-1.7"], "test.docx"),
  ])
    await expect(validatePdf(invalid, 20)).rejects.toMatchObject({
      code: "INVALID_PDF",
    });
  await expect(validatePdf(file, 0.000001)).rejects.toMatchObject({
    code: "TOO_LARGE",
  });
});
it("uses signed resumable chunks and only reports success after Storage acknowledges it", async () => {
  const transfer = new PdfTransfer(file, ticket),
    progress = vi.fn();
  const promise = transfer.start(progress);
  expect(state.options.chunkSize).toBe(6 * 1024 * 1024);
  expect(state.options.headers).toEqual({ "x-signature": ticket.token });
  expect(state.options.storeFingerprintForResuming).toBe(false);
  state.options.onProgress!(file.size, file.size);
  expect(progress).toHaveBeenLastCalledWith(99);
  expect(transfer.uploaded).toBe(false);
  state.options.onSuccess!({ lastResponse: null! });
  await promise;
  expect(transfer.uploaded).toBe(true);
  expect(progress).toHaveBeenLastCalledWith(100);
});
it("retains the transfer for retry and does not mark a network failure successful", async () => {
  const transfer = new PdfTransfer(file, ticket);
  const first = transfer.start(vi.fn());
  state.options.onError!(new Error("secret URL must never be surfaced"));
  await expect(first).rejects.toMatchObject({ code: "NETWORK" });
  expect(transfer.uploaded).toBe(false);
  const retry = transfer.start(vi.fn());
  state.options.onSuccess!({ lastResponse: null! });
  await retry;
  expect(state.starts).toBe(2);
});
it("cancellation settles the pending transfer with a distinct error", async () => {
  const transfer = new PdfTransfer(file, ticket),
    promise = transfer.start(vi.fn());
  const assertion = expect(promise).rejects.toMatchObject({
    code: "CANCELLED",
  });
  await transfer.cancel();
  await assertion;
});
it.each([
  [401, {}, false, "AUTH"],
  [403, {}, true, "PERMISSION"],
  [413, {}, true, "TOO_LARGE"],
  [400, { message: "jwt expired" }, true, "EXPIRED"],
  [404, { message: "Bucket not found" }, true, "BUCKET"],
  [503, {}, true, "SERVER"],
  [0, {}, true, "NETWORK"],
  [408, {}, true, "TIMEOUT"],
] as const)(
  "classifies status %s without leaking raw details",
  (status, body, storage, code) => {
    expect(uploadFailure(status, body, storage).code).toBe(code);
  },
);
it("handles an expired app session and malformed API responses", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "private detail" }), {
          status: 401,
        }),
      )
      .mockResolvedValueOnce(
        new Response("<html>error</html>", { status: 502 }),
      ),
  );
  await expect(uploadApi("/api/uploads", {})).rejects.toMatchObject({
    code: "AUTH",
  });
  await expect(uploadApi("/api/uploads", {})).rejects.toMatchObject({
    code: "SERVER",
  });
});
it("development diagnostics contain only stage, code and HTTP status", () => {
  vi.stubEnv("NODE_ENV", "development");
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  logUploadFailure("storage", new UploadError("NETWORK"));
  expect(warn).toHaveBeenCalledWith("[ThesisGuard upload]", {
    stage: "storage",
    code: "NETWORK",
    status: 0,
  });
  vi.unstubAllEnvs();
});
