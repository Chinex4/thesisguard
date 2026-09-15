import { after, NextResponse } from "next/server";
import { z } from "zod";
import { requireApi, HttpError } from "@/lib/auth/session";
import { adminDb } from "@/lib/supabase/admin";
import { report } from "@/lib/services/data";
import { runScan } from "@/lib/services/scan";

export const runtime = "nodejs";
export const maxDuration = 300;

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Context) {
  try {
    const user = await requireApi();
    const url = new URL(request.url);
    const origin = request.headers.get("origin");
    if (!origin || origin !== url.origin)
      throw new HttpError(403, "Request origin is not allowed.");

    const id = z.uuid().parse((await params).id);
    const data = await report(id);
    if (!data) throw new HttpError(404, "Scan not found.");

    if (user.role !== "ADMIN" && data.scan.requested_by !== user.id)
      throw new HttpError(403, "This scan is not available to you.");

    if (data.scan.status !== "QUEUED")
      return NextResponse.json({ status: data.scan.status });

    const now = new Date().toISOString();
    const db = adminDb();
    const { data: claimed, error } = await db
      .from("plagiarism_scans")
      .update({
        status: "EXTRACTING",
        started_at: now,
        heartbeat_at: now,
        attempts: 1,
      })
      .eq("id", id)
      .eq("status", "QUEUED")
      .select("id")
      .maybeSingle();

    if (error) throw new HttpError(503, "Scan could not be started.");
    if (!claimed)
      return NextResponse.json({ status: "ALREADY_STARTED" }, { status: 202 });

    after(async () => {
      await runScan(id);
    });

    return NextResponse.json({ status: "STARTED" }, { status: 202 });
  } catch (e) {
    if (e instanceof z.ZodError)
      return NextResponse.json({ error: e.issues[0].message }, { status: 400 });
    return NextResponse.json(
      {
        error:
          e instanceof HttpError
            ? e.message
            : "This scan could not be started. Please try again.",
      },
      { status: e instanceof HttpError ? e.status : 503 },
    );
  }
}
