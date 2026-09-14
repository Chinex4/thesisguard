import "server-only";
import { serverDb } from "@/lib/supabase/server";
import { thesisSelect } from "./data";
import type { Thesis } from "@/types";
export async function searchRepository(
  params: Record<string, string | undefined>,
) {
  const db = await serverDb();
  const page = Math.max(1, Math.min(10000, Number(params.page) || 1));
  let query = db
    .from("theses")
    .select(thesisSelect, { count: "exact" })
    .eq("status", "APPROVED");
  const q = (params.q || "")
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .trim()
    .slice(0, 100);
  if (q) {
    const { data: authors } = await db
      .from("profiles")
      .select("id")
      .ilike("full_name", "%" + q + "%")
      .limit(100);
    let condition =
      "title.ilike.%" +
      q +
      "%,abstract.ilike.%" +
      q +
      "%,keywords.ov.{" +
      q.split(/\s+/).join(",") +
      "}";
    if (authors?.length)
      condition +=
        ",student_id.in.(" + authors.map((a) => a.id).join(",") + ")";
    query = query.or(condition);
  }
  if (params.department) query = query.eq("department_id", params.department);
  if (params.faculty) query = query.eq("faculty_id", params.faculty);
  if (params.year && /^\d{4}$/.test(params.year))
    query = query.eq("academic_year", Number(params.year));
  const sort = params.sort || "newest";
  query = query
    .order(sort === "title" ? "title" : "created_at", {
      ascending: sort !== "newest",
    })
    .range((page - 1) * 12, page * 12 - 1);
  const { data, count, error } = await query;
  if (error)
    throw new Error(
      "Repository search is unavailable. Try clearing your filters.",
    );
  return { items: data as unknown as Thesis[], count: count || 0, page };
}
