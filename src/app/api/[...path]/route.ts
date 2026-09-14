import { readJson } from "@/lib/security/request-body";
import { searchRepository } from "@/lib/services/repository";
import {
  beginUpload,
  finishUpload,
  discardUpload,
} from "@/lib/services/uploads";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApi, HttpError } from "@/lib/auth/session";
import { adminDb } from "@/lib/supabase/admin";
import { serverDb } from "@/lib/supabase/server";
import { createThesis, ownedThesis } from "@/lib/services/theses";
import { report } from "@/lib/services/data";
import { reviewSchema, settingsSchema } from "@/lib/validations";
import { retryGuidance } from "@/lib/services/scan";
import { createReportPdf } from "@/lib/reports/pdf";
export const runtime = "nodejs";
export const maxDuration = 300;
type Context = { params: Promise<{ path: string[] }> };
async function handle(request: Request, { params }: Context) {
  try {
    const { path } = await params;
    const user = await requireApi();
    const db = adminDb();
    const method = request.method;
    const url = new URL(request.url);
    if (method !== "GET") {
      const origin = request.headers.get("origin");
      if (!origin || origin !== url.origin)
        throw new HttpError(403, "Request origin is not allowed.");
    }
    if (method === "POST" && path.join("/") === "uploads") {
      if (user.role !== "STUDENT")
        throw new HttpError(403, "Only students can upload theses.");
      return NextResponse.json(
        await beginUpload(await readJson(request), user),
      );
    }
    if (method === "DELETE" && path.join("/") === "uploads") {
      if (user.role !== "STUDENT")
        throw new HttpError(403, "Only students can upload theses.");
      await discardUpload(await readJson(request), user);
      return NextResponse.json({ success: true });
    }
    if (method === "POST" && path.join("/") === "theses") {
      if (user.role !== "STUDENT")
        throw new HttpError(403, "Only students can upload theses.");
      if (Number(request.headers.get("content-length")) > 22 * 1024 * 1024)
        throw new HttpError(413, "Upload is too large.");
      return NextResponse.json(
        {
          id: request.headers.get("content-type")?.includes("application/json")
            ? await finishUpload(await readJson(request), user)
            : await createThesis(await request.formData(), user),
        },
        { status: 201 },
      );
    }
    if (path[0] === "theses" && path[1]) {
      const id = z.uuid().parse(path[1]);
      const t = await ownedThesis(id, user);
      if (method === "POST" && path[2] === "scan") {
        const { data, error } = await db.rpc("enqueue_scan", {
          p_thesis: id,
          p_user: user.id,
        });
        if (error)
          throw new HttpError(
            409,
            error.code === "23505"
              ? "A scan is already running for this thesis."
              : error.message.includes("Daily")
                ? "Daily scan limit reached. Try again tomorrow."
                : "This thesis cannot be scanned right now.",
          );
        return NextResponse.json({ id: data }, { status: 202 });
      }
      if (method === "PATCH" && path.length === 2) {
        const body = z
          .object({
            status: z.enum(["SUBMITTED", "ARCHIVED"]),
            supervisor_id: z.uuid().optional(),
          })
          .parse(await readJson(request));
        if (
          body.status === "SUBMITTED" &&
          (t.student_id !== user.id || t.status !== "DRAFT")
        )
          throw new HttpError(403, "Only your own draft can be submitted.");
        if (body.status === "ARCHIVED" && user.role !== "ADMIN")
          throw new HttpError(403, "Administrator access required.");
        const { error } = await db
          .from("theses")
          .update({ status: body.status })
          .eq("id", id);
        if (error) throw error;
        return NextResponse.json({ success: true });
      }
      if (method === "POST" && path[2] === "review") {
        await ownedThesis(id, user, true);
        const body = reviewSchema.parse(await readJson(request));
        if (!["SUBMITTED", "UNDER_REVIEW"].includes(t.status))
          throw new HttpError(409, "Only submitted theses can be reviewed.");
        const { error } = await db.rpc("review_thesis", {
          p_thesis: id,
          p_reviewer: user.id,
          p_decision: body.decision,
          p_comment: body.comment,
        });
        if (error)
          throw new HttpError(
            409,
            "Review could not be saved. The submission may have changed.",
          );
        return NextResponse.json({ success: true });
      }
      if (method === "DELETE" && path.length === 2) {
        if (user.role !== "ADMIN")
          throw new HttpError(403, "Administrator access required.");
        if (!["ARCHIVED", "DRAFT"].includes(t.status))
          throw new HttpError(400, "Archive the thesis before deleting it.");
        const { error } = await db.from("theses").delete().eq("id", id);
        if (error)
          throw new HttpError(
            409,
            "This thesis is referenced by another version. Archive it instead.",
          );
        const { error: storageError } = await db.storage
          .from("theses")
          .remove([t.document_path]);
        return NextResponse.json({
          success: true,
          warning: storageError
            ? "Document record deleted; storage cleanup needs administrator attention."
            : undefined,
        });
      }
    }
    if (method === "GET" && path[0] === "documents" && path[1]) {
      const reader = await serverDb();
      const { data: t } = await reader
        .from("theses")
        .select("document_path")
        .eq("id", z.uuid().parse(path[1]))
        .single();
      if (!t) throw new HttpError(404, "Document unavailable.");
      const { data, error } = await reader.storage
        .from("theses")
        .createSignedUrl(t.document_path, 60, { download: true });
      if (error) throw new HttpError(503, "Download unavailable.");
      return NextResponse.redirect(data.signedUrl);
    }
    if (path[0] === "scans" && path[1]) {
      const data = await report(z.uuid().parse(path[1]));
      if (!data) throw new HttpError(404, "Scan not found.");
      if (method === "GET")
        return NextResponse.json(data.scan, {
          headers: { "Cache-Control": "private, no-store" },
        });
      if (method === "POST" && path[2] === "ai") {
        if (data.scan.status !== "COMPLETED")
          throw new HttpError(
            409,
            "Wait for the deterministic scan to complete.",
          );
        if (data.scan.ai_status === "AVAILABLE")
          throw new HttpError(409, "AI guidance is already available.");
        const { data: claimed } = await db
          .from("plagiarism_scans")
          .update({ ai_status: "RETRYING" })
          .eq("id", path[1])
          .eq("ai_status", "UNAVAILABLE")
          .select("id")
          .maybeSingle();
        if (!claimed)
          throw new HttpError(409, "AI guidance is already being retried.");
        try {
          await retryGuidance(path[1]);
        } catch {
          await db
            .from("plagiarism_scans")
            .update({ ai_status: "UNAVAILABLE" })
            .eq("id", path[1]);
          throw new HttpError(
            503,
            "AI guidance remains unavailable. Please check the API configuration.",
          );
        }
        return NextResponse.json({ success: true });
      }
    }
    if (method === "GET" && path[0] === "reports" && path[2] === "pdf") {
      const data = await report(z.uuid().parse(path[1]));
      if (!data) throw new HttpError(404, "Report not found.");
      if (data.scan.status !== "COMPLETED")
        throw new HttpError(409, "Report is not ready.");
      return new Response(Buffer.from(await createReportPdf(data)), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition":
            'attachment; filename="thesisguard-report.pdf"',
          "Cache-Control": "private, no-store",
        },
      });
    }
    if (method === "GET" && path.join("/") === "repository/search")
      return NextResponse.json(
        await searchRepository(Object.fromEntries(url.searchParams)),
      );
    if (method === "PATCH" && path[0] === "profile") {
      const body = z
        .object({
          full_name: z.string().trim().min(3).max(100),
          matric_number: z.string().max(40).nullable().optional(),
        })
        .parse(await readJson(request));
      const { error } = await db
        .from("profiles")
        .update(body)
        .eq("id", user.id);
      if (error) throw error;
      return NextResponse.json({ success: true });
    }
    if (path[0] === "admin") {
      if (user.role !== "ADMIN")
        throw new HttpError(403, "Administrator access required.");
      if (method === "PATCH" && path[1] === "settings") {
        const body = settingsSchema.parse(await readJson(request));
        const { error } = await db
          .from("system_settings")
          .update(body)
          .eq("id", true);
        if (error) throw error;
        return NextResponse.json({ success: true });
      }
      if (method === "PATCH" && path[1] === "users") {
        const body = z
          .object({
            id: z.uuid(),
            role: z.enum(["STUDENT", "SUPERVISOR", "ADMIN"]),
          })
          .parse(await readJson(request));
        if (body.id === user.id)
          throw new HttpError(
            400,
            "You cannot change your own administrator role.",
          );
        const { error } = await db
          .from("profiles")
          .update({ role: body.role })
          .eq("id", body.id);
        if (error) throw error;
        return NextResponse.json({ success: true });
      }
      if (method === "PATCH" && path[1] === "assignment") {
        const body = z
          .object({ thesis_id: z.uuid(), supervisor_id: z.uuid() })
          .parse(await readJson(request));
        const { data: p } = await db
          .from("profiles")
          .select("role")
          .eq("id", body.supervisor_id)
          .single();
        if (p?.role !== "SUPERVISOR")
          throw new HttpError(400, "Select a supervisor account.");
        const { error } = await db
          .from("theses")
          .update({ supervisor_id: body.supervisor_id })
          .eq("id", body.thesis_id);
        if (error) throw error;
        return NextResponse.json({ success: true });
      }
      if (
        ["POST", "PATCH", "DELETE"].includes(method) &&
        ["departments", "faculties"].includes(path[1])
      ) {
        const body = await readJson(request);
        if (method === "DELETE") {
          const { error } = await db
            .from(path[1])
            .delete()
            .eq("id", z.uuid().parse(body.id));
          if (error)
            throw new HttpError(
              409,
              "This entry is in use and cannot be deleted.",
            );
        } else {
          const values = z
            .object({
              name: z.string().trim().min(2).max(100),
              code: z.string().trim().min(2).max(12),
              ...(path[1] === "departments" ? { faculty_id: z.uuid() } : {}),
            })
            .parse(body);
          const result =
            method === "POST"
              ? await db.from(path[1]).insert(values)
              : await db
                  .from(path[1])
                  .update(values)
                  .eq("id", z.uuid().parse(body.id));
          if (result.error)
            throw new HttpError(
              400,
              "Could not save this entry. Check for a duplicate name or code.",
            );
        }
        return NextResponse.json({ success: true });
      }
    }
    throw new HttpError(404, "Endpoint not found.");
  } catch (e) {
    if (e instanceof z.ZodError)
      return NextResponse.json({ error: e.issues[0].message }, { status: 400 });
    return NextResponse.json(
      {
        code: e instanceof HttpError && "code" in e ? e.code : undefined,
        error:
          e instanceof HttpError
            ? e.message
            : "This action could not be completed. Please try again.",
      },
      { status: e instanceof HttpError ? e.status : 503 },
    );
  }
}
export const GET = handle;
export const POST = handle;
export const PATCH = handle;
export const DELETE = handle;
