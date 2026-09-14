import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { adminDb } from "@/lib/supabase/admin";
import { HttpError } from "@/lib/auth/session";
import { sanitizeFilename } from "@/lib/documents/extract-document";
import { createThesis } from "./theses";
import { thesisSchema } from "@/lib/validations";
import { limit } from "@/lib/config";
import { uploadFailure } from "@/lib/uploads/errors";
import type { Profile } from "@/types";

function storageError(error: {
  message: string;
  status?: number;
  statusCode?: string;
}) {
  const failure = uploadFailure(
    Number(error.status || error.statusCode) || 503,
    { message: error.message },
    true,
  );
  return Object.assign(new HttpError(failure.status || 503, failure.message), {
    code: failure.code,
  });
}

export function resumableEndpoint(projectUrl: string, signedUrl?: string) {
  const base = new URL(projectUrl);
  // Prefer the signed URL's origin when available so the upload token and TUS
  // destination can never accidentally point at different Supabase projects.
  const url = signedUrl ? new URL(signedUrl, base) : base;

  // Hosted Supabase direct storage domain; keep custom/local origins unchanged.
  if (/^[a-z0-9-]+\.supabase\.co$/.test(url.hostname))
    url.hostname = url.hostname.replace(".supabase.co", ".storage.supabase.co");

  url.pathname = "/storage/v1/upload/resumable";
  url.search = "";
  url.hash = "";
  return url.toString();
}

export async function beginUpload(input: unknown, user: Profile) {
  const body = z
    .object({
      name: z.string().min(1).max(250),
      size: z.number().int().positive(),
      metadata: thesisSchema.optional(),
    })
    .parse(input);

  if (!/\.pdf$/i.test(body.name))
    throw Object.assign(new HttpError(400, "Choose a PDF document."), {
      code: "INVALID_PDF",
    });

  const db = adminDb();
  const { data: settings, error: settingError } = await db
    .from("system_settings")
    .select("maximum_file_size")
    .eq("id", true)
    .single();
  if (settingError || !settings)
    throw new HttpError(503, "Institution settings unavailable.");

  const max = Math.min(
    settings.maximum_file_size,
    limit("MAX_UPLOAD_SIZE_MB", 20, 20),
  );
  if (body.size > max * 1024 * 1024)
    throw Object.assign(
      new HttpError(413, "Document exceeds the institution upload limit."),
      { code: "TOO_LARGE" },
    );

  const path =
    user.id + "/staging/" + randomUUID() + "/" + sanitizeFilename(body.name);
  const { data, error } = await db.storage
    .from("theses")
    .createSignedUploadUrl(path, { upsert: false });
  if (error) throw storageError(error);

  const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!projectUrl)
    throw new HttpError(503, "Supabase project URL is unavailable.");

  return {
    path,
    signedUrl: data.signedUrl,
    token: data.token,
    endpoint: resumableEndpoint(projectUrl, data.signedUrl),
  };
}

export function validateStagingPath(path: string, userId: string) {
  const pieces = path.split("/");
  if (
    pieces.length !== 4 ||
    pieces[0] !== userId ||
    pieces[1] !== "staging" ||
    !z.uuid().safeParse(pieces[2]).success ||
    sanitizeFilename(pieces[3]) !== pieces[3] ||
    !pieces[3]
  )
    throw new HttpError(403, "This upload does not belong to your account.");
}

export async function discardUpload(input: unknown, user: Profile) {
  const { path } = z.object({ path: z.string() }).parse(input);
  validateStagingPath(path, user.id);
  const { error } = await adminDb().storage.from("theses").remove([path]);
  if (error) throw storageError(error);
}

export async function finishUpload(input: unknown, user: Profile) {
  const body = z
    .object({ path: z.string(), metadata: thesisSchema })
    .parse(input);
  validateStagingPath(body.path, user.id);
  const db = adminDb();
  const id = body.path.split("/")[2];

  const { data: existing, error: lookupError } = await db
    .from("theses")
    .select("id,student_id")
    .eq("id", id)
    .maybeSingle();
  if (lookupError) throw new HttpError(503, "Database unavailable.");
  if (existing) {
    if (existing.student_id !== user.id)
      throw new HttpError(403, "This upload does not belong to your account.");
    // An acknowledged or lost-response retry always returns the original submission.
    await db.storage.from("theses").remove([body.path]);
    return existing.id;
  }

  const { data: file, error } = await db.storage
    .from("theses")
    .download(body.path);
  if (error || !file)
    throw new HttpError(
      400,
      "Uploaded document unavailable. Choose your file again.",
    );

  const form = new FormData();
  for (const [key, value] of Object.entries(body.metadata))
    if (value !== undefined) form.set(key, String(value));
  form.set(
    "file",
    new File([file], body.path.split("/").at(-1)!, { type: file.type }),
  );

  // Preserve staging on failed finalization so retries do not transfer the PDF again.
  const result = await createThesis(form, user, id);
  await db.storage.from("theses").remove([body.path]);
  return result;
}
