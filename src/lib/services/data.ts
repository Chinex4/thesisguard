import "server-only";
import { serverDb } from "@/lib/supabase/server";
import { configured } from "@/lib/config";
import type { Thesis, Scan, Settings } from "@/types";
export const thesisSelect =
  "id,student_id,supervisor_id,title,abstract,keywords,faculty_id,department_id,academic_year,document_path,original_filename,mime_type,file_size,status,word_count,approved_at,created_at,updated_at,version_of,student:profiles!theses_student_id_fkey(full_name,matric_number),department:departments(name),faculty:faculties(name),supervisor:profiles!theses_supervisor_id_fkey(full_name)";
export async function directories() {
  if (!configured()) return { faculties: [], departments: [], supervisors: [] };
  const db = await serverDb();
  const [f, d, s] = await Promise.all([
    db.from("faculties").select("*").order("name"),
    db.from("departments").select("*").order("name"),
    db.from("profiles").select("id,full_name").eq("role", "SUPERVISOR"),
  ]);
  if (f.error || d.error)
    throw new Error("Institution directory is unavailable.");
  return {
    faculties: f.data || [],
    departments: d.data || [],
    supervisors: s.data || [],
  };
}
export async function theses() {
  const db = await serverDb();
  const { data, error } = await db
    .from("theses")
    .select(thesisSelect)
    .order("created_at", { ascending: false });
  if (error) throw new Error("Theses could not be loaded.");
  return data as unknown as Thesis[];
}
export async function thesis(id: string) {
  const db = await serverDb();
  const { data, error } = await db
    .from("theses")
    .select(thesisSelect)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error("Thesis could not be loaded.");
  return data as Thesis | null;
}
export async function scans() {
  const db = await serverDb();
  const { data, error } = await db
    .from("plagiarism_scans")
    .select("*,thesis:theses(title,student_id,supervisor_id)")
    .order("created_at", { ascending: false });
  if (error) throw new Error("Scans could not be loaded.");
  return data as Scan[];
}
export async function report(id: string) {
  const db = await serverDb();
  const [scan, sources, matches] = await Promise.all([
    db
      .from("plagiarism_scans")
      .select("*,thesis:theses(" + thesisSelect + ")")
      .eq("id", id)
      .maybeSingle(),
    db
      .from("scan_sources")
      .select("*")
      .eq("scan_id", id)
      .order("similarity_score", { ascending: false }),
    db
      .from("similarity_matches")
      .select("*")
      .eq("scan_id", id)
      .order("start_position"),
  ]);
  if (scan.error || sources.error || matches.error)
    throw new Error("Report could not be loaded.");
  if (!scan.data) return null;
  return {
    scan: scan.data as unknown as Scan,
    sources: sources.data || [],
    matches: matches.data || [],
  };
}
export async function settings() {
  const db = await serverDb();
  const { data, error } = await db
    .from("system_settings")
    .select("*")
    .eq("id", true)
    .single();
  if (error) throw new Error("Institution settings could not be loaded.");
  return data as Settings;
}
