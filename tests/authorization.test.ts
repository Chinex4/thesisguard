import { vi, it, expect, beforeEach } from "vitest";
const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  admin: vi.fn(),
  thesis: vi.fn(),
}));
vi.mock("@/lib/auth/session", () => ({
  requireApi: mocks.session,
  HttpError: class HttpError extends Error {
    constructor(
      public status: number,
      message: string,
    ) {
      super(message);
    }
  },
}));
vi.mock("@/lib/supabase/admin", () => ({ adminDb: mocks.admin }));
vi.mock("@/lib/services/theses", () => ({
  ownedThesis: mocks.thesis,
  createThesis: vi.fn(),
}));
import { POST, PATCH } from "@/app/api/[...path]/route";
import { HttpError } from "@/lib/auth/session";
import { validateStagingPath } from "@/lib/services/uploads";
const id = "10000000-0000-4000-8000-000000000001";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.session.mockResolvedValue({ id, role: "STUDENT" });
  mocks.admin.mockReturnValue({});
});
it("rejects unauthenticated mutations before privileged database access", async () => {
  mocks.session.mockRejectedValue(new HttpError(401, "Please sign in."));
  const response = await POST(
    new Request("http://localhost/api/theses", { method: "POST" }),
    { params: Promise.resolve({ path: ["theses"] }) },
  );
  expect(response.status).toBe(401);
  expect(mocks.admin).not.toHaveBeenCalled();
});
it("rejects cross-origin mutations", async () => {
  const response = await POST(
    new Request("http://localhost/api/theses", {
      method: "POST",
      headers: { Origin: "https://attacker.test" },
    }),
    { params: Promise.resolve({ path: ["theses"] }) },
  );
  expect(response.status).toBe(403);
});
it("denies student access to administrator settings", async () => {
  const response = await PATCH(
    new Request("http://localhost/api/admin/settings", {
      method: "PATCH",
      headers: { Origin: "http://localhost" },
    }),
    { params: Promise.resolve({ path: ["admin", "settings"] }) },
  );
  expect(response.status).toBe(403);
});
it("rejects unauthorized thesis scans", async () => {
  mocks.thesis.mockRejectedValue(
    new HttpError(403, "This thesis is not available to you."),
  );
  const response = await POST(
    new Request("http://localhost/api/theses/" + id + "/scan", {
      method: "POST",
      headers: { Origin: "http://localhost" },
    }),
    { params: Promise.resolve({ path: ["theses", id, "scan"] }) },
  );
  expect(response.status).toBe(403);
});
it("restricts signed-upload finalization to the owner’s staging folder", () => {
  const path = id + "/staging/20000000-0000-4000-8000-000000000001/thesis.pdf";
  expect(() => validateStagingPath(path, id)).not.toThrow();
  expect(() => validateStagingPath(path, "another-user")).toThrow();
  expect(() =>
    validateStagingPath(id + "/staging/../thesis.pdf", id),
  ).toThrow();
  expect(() => validateStagingPath(id + "/finalized/thesis.pdf", id)).toThrow();
});
