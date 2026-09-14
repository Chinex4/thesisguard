import { beforeEach, it, expect, vi } from "vitest";
import type { Profile } from "@/types";
const m = vi.hoisted(() => ({
  existing: null as { id: string; student_id: string } | null,
  download: vi.fn(),
  remove: vi.fn(),
  create: vi.fn(),
  sign: vi.fn(),
  maximum: 20,
}));
vi.mock("@/lib/services/theses", () => ({ createThesis: m.create }));
vi.mock("@/lib/supabase/admin", () => ({
  adminDb: () => ({
    from: () => {
      const chain = {
        select: () => chain,
        eq: () => chain,
        maybeSingle: async () => ({ data: m.existing, error: null }),
        single: async () => ({
          data: { maximum_file_size: m.maximum },
          error: null,
        }),
      };
      return chain;
    },
    storage: {
      from: () => ({
        download: m.download,
        remove: m.remove,
        createSignedUploadUrl: m.sign,
      }),
    },
  }),
}));
import {
  finishUpload,
  beginUpload,
  discardUpload,
  resumableEndpoint,
} from "@/lib/services/uploads";
const user = {
  id: "10000000-0000-4000-8000-000000000001",
  role: "STUDENT",
} as Profile;
const id = "20000000-0000-4000-8000-000000000001";
const path = user.id + "/staging/" + id + "/thesis.pdf";
const metadata = {
  title: "Testing PDF upload correctly",
  abstract:
    "This abstract describes a complete research project with enough details for validation and testing.",
  keywords: "research",
  academic_year: 2026,
  faculty_id: "30000000-0000-4000-8000-000000000001",
  department_id: "40000000-0000-4000-8000-000000000001",
  status: "DRAFT",
  supervisor_id: "",
  version_of: "",
};
beforeEach(() => {
  vi.clearAllMocks();
  m.existing = null;
  m.maximum = 20;
  m.download.mockResolvedValue({
    data: new Blob(["%PDF-1.7 sample"]),
    error: null,
  });
  m.remove.mockResolvedValue({ error: null });
  m.create.mockResolvedValue(id);
  m.sign.mockResolvedValue({
    data: { signedUrl: "private", token: "private" },
    error: null,
  });
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
});
it("never creates a thesis when storage cannot confirm the file", async () => {
  m.download.mockResolvedValue({ data: null, error: { message: "missing" } });
  await expect(finishUpload({ path, metadata }, user)).rejects.toThrow(
    "unavailable",
  );
  expect(m.create).not.toHaveBeenCalled();
});
it.each(["DRAFT", "SUBMITTED"])(
  "preserves metadata and revision when saving %s",
  async (status) => {
    await finishUpload(
      { path, metadata: { ...metadata, status, version_of: id } },
      user,
    );
    const form = m.create.mock.calls[0][0] as FormData;
    expect(form.get("status")).toBe(status);
    expect(form.get("version_of")).toBe(id);
    expect(form.get("title")).toBe(metadata.title);
    expect(m.create.mock.calls[0][2]).toBe(id);
    expect(m.remove).toHaveBeenCalledWith([path]);
  },
);
it("retains staging on failure and retries using the same database identity", async () => {
  m.create.mockRejectedValueOnce(new Error("temporary failure"));
  await expect(finishUpload({ path, metadata }, user)).rejects.toThrow();
  expect(m.remove).not.toHaveBeenCalled();
  await finishUpload({ path, metadata }, user);
  expect(m.create.mock.calls.map((call) => call[2])).toEqual([id, id]);
});
it("returns the committed ID after a lost finalization response without re-uploading", async () => {
  m.existing = { id, student_id: user.id };
  expect(await finishUpload({ path, metadata }, user)).toBe(id);
  expect(m.download).not.toHaveBeenCalled();
  expect(m.create).not.toHaveBeenCalled();
});
it("rejects another user's cleanup request", async () => {
  await expect(discardUpload({ path }, { ...user, id })).rejects.toThrow(
    "belong",
  );
  expect(m.remove).not.toHaveBeenCalled();
});
it("checks institution size and PDF extension before issuing credentials", async () => {
  m.maximum = 5;
  await expect(
    beginUpload({ name: "test.pdf", size: 6 * 1024 * 1024 }, user),
  ).rejects.toMatchObject({ status: 413 });
  await expect(
    beginUpload({ name: "test.docx", size: 100 }, user),
  ).rejects.toMatchObject({ status: 400 });
  expect(m.sign).not.toHaveBeenCalled();
});
it("uses the direct hosted storage endpoint and preserves custom/local endpoints", () => {
  expect(resumableEndpoint("https://example.supabase.co")).toBe(
    "https://example.storage.supabase.co/storage/v1/upload/resumable",
  );
  expect(resumableEndpoint("http://127.0.0.1:54321")).toBe(
    "http://127.0.0.1:54321/storage/v1/upload/resumable",
  );
  expect(resumableEndpoint("https://custom.example.org")).toBe(
    "https://custom.example.org/storage/v1/upload/resumable",
  );
});
