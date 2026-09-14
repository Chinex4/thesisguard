import "server-only";
import { randomUUID } from "node:crypto";
import { adminDb } from "@/lib/supabase/admin";
import { HttpError } from "@/lib/auth/session";
import { thesisSchema } from "@/lib/validations";
import {
  extractDocument,
  sanitizeFilename,
} from "@/lib/documents/extract-document";
import { normalizeText } from "@/lib/documents/normalize-text";
import { tokenize } from "@/lib/plagiarism/tokenize";
import { chunkText } from "@/lib/documents/chunk-text";
import type { Profile, Thesis } from "@/types";
import { limit } from "@/lib/config";
import { uploadFailure } from "@/lib/uploads/errors";
export async function ownedThesis(
  id: string,
  user: Profile,
  staffOnly = false,
) {
  const db = adminDb();
  const { data, error } = await db
    .from("theses")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new HttpError(503, "Database unavailable.");
  const t = data as Thesis | null;
  if (
    !t ||
    !(
      user.role === "ADMIN" ||
      (user.role === "SUPERVISOR" && t.supervisor_id === user.id) ||
      (!staffOnly && t.student_id === user.id)
    )
  )
    throw new HttpError(403, "This thesis is not available to you.");
  return t;
}
export async function createThesis(
  form: FormData,
  user: Profile,
  uploadId?: string,
) {
  const meta = thesisSchema.parse(Object.fromEntries(form));
  const file = form.get("file");
  if (!(file instanceof File))
    throw new HttpError(400, "Choose a PDF document.");
  if (!/\.pdf$/i.test(file.name))
    throw new HttpError(400, "Choose a PDF document.");
  const db = adminDb();
  const { data: settings, error: settingError } = await db
    .from("system_settings")
    .select("*")
    .eq("id", true)
    .single();
  if (settingError)
    throw new HttpError(503, "Institution settings unavailable.");
  const max = Math.min(
    settings.maximum_file_size,
    limit("MAX_UPLOAD_SIZE_MB", 20, 20),
  );
  if (file.size > max * 1024 * 1024)
    throw new HttpError(413, "File exceeds the institution upload limit.");
  const { data: department } = await db
    .from("departments")
    .select("faculty_id")
    .eq("id", meta.department_id)
    .single();
  if (department?.faculty_id !== meta.faculty_id)
    throw new HttpError(400, "Select a department within the chosen faculty.");
  if (meta.supervisor_id) {
    const { data: supervisor } = await db
      .from("profiles")
      .select("role")
      .eq("id", meta.supervisor_id)
      .single();
    if (supervisor?.role !== "SUPERVISOR")
      throw new HttpError(400, "Invalid supervisor.");
  }
  if (meta.version_of) {
    const previous = await ownedThesis(meta.version_of, user);
    if (
      previous.student_id !== user.id ||
      !settings.allow_student_resubmission ||
      !["REJECTED", "DRAFT"].includes(previous.status)
    )
      throw new HttpError(
        400,
        "Resubmission is not currently allowed for this thesis.",
      );
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  let extracted;
  try {
    extracted = await extractDocument(buffer, max);
  } catch (e) {
    throw Object.assign(new HttpError(400, (e as Error).message), {
      code: "INVALID_PDF",
    });
  }
  if (extracted.kind !== "pdf")
    throw new HttpError(400, "Choose a valid PDF document.");
  const id = uploadId || randomUUID(),
    filename = sanitizeFilename(file.name),
    document_path = user.id + "/" + id + "/" + filename;
  const { error: uploadError } = await db.storage
    .from("theses")
    .upload(document_path, buffer, {
      contentType: extracted.mime,
      upsert: false,
    });
  if (uploadError) {
    const failure = uploadFailure(
      Number(uploadError.statusCode) || 503,
      { message: uploadError.message },
      true,
    );
    if (failure.code !== "CONFLICT")
      throw Object.assign(new HttpError(failure.status, failure.message), {
        code: failure.code,
      });
    // Resume finalization after a process crash or an ambiguous storage response.
    const { data: stored } = await db.storage
      .from("theses")
      .download(document_path);
    if (!stored || !buffer.equals(Buffer.from(await stored.arrayBuffer())))
      throw new HttpError(
        409,
        "This upload is already being processed. Wait briefly and retry.",
      );
  }
  try {
    const record = {
      id,
      student_id: user.id,
      ...meta,
      supervisor_id: meta.supervisor_id || null,
      version_of: meta.version_of || null,
      keywords: meta.keywords
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean),
      document_path,
      original_filename: filename,
      mime_type: extracted.mime,
      file_size: buffer.length,
      extracted_text: extracted.text,
      normalized_text: normalizeText(extracted.text),
      word_count: tokenize(extracted.text).length,
    };
    const chunks = chunkText(extracted.text).map(({ start_word, ...c }) => {
      void start_word;
      return { ...c, thesis_id: id };
    });
    const { error } = await db.rpc("finalize_thesis_upload", {
      p_thesis: record,
      p_chunks: chunks,
    });
    if (error) throw error;
    return id;
  } catch {
    // A transport failure may hide a committed RPC response. Never delete a committed thesis.
    const { data: committed, error: lookupError } = await db
      .from("theses")
      .select("id")
      .eq("id", id)
      .eq("student_id", user.id)
      .maybeSingle();
    if (committed) return id;
    void lookupError;
    // Keep retryable bytes; maintenance removes old, unreferenced objects.
    // Immediate removal could race another finalization of the same upload.
    throw new HttpError(
      503,
      "The thesis could not be saved. Please try again.",
    );
  }
}
