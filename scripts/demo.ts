import { loadEnvConfig } from "@next/env";
import { PDFDocument, StandardFonts } from "pdf-lib";
loadEnvConfig(process.cwd());
async function main() {
  const { adminDb } = await import("../src/lib/supabase/admin");
  const { createThesis } = await import("../src/lib/services/theses");
  const id = process.argv[2];
  if (!id) throw new Error("Usage: npm run demo -- STUDENT_UUID");
  const db = adminDb();
  const { data: user, error } = await db
    .from("profiles")
    .select("*")
    .eq("id", id)
    .eq("role", "STUDENT")
    .single();
  if (error || !user)
    throw new Error(
      "Create a real Supabase Auth student account first and supply its profile UUID.",
    );
  const { data: department } = await db
    .from("departments")
    .select("id,faculty_id")
    .limit(1)
    .single();
  if (!department) throw new Error("Apply supabase/seed.sql first.");
  const samples = [
    [
      "Distributed Environmental Monitoring Networks",
      "Distributed sensor networks monitor environmental conditions through coordinated measurements across geographically separated research stations. Researchers calibrate sophisticated instruments using laboratory experiments and rigorous mathematical simulations before deploying these environmental monitoring systems.",
    ],
    [
      "Digital Libraries and Research Preservation",
      "Digital repositories preserve institutional research by organizing academic documents with consistent descriptive metadata. Carefully designed access policies enable students and supervisors to discover reliable research while protecting private submissions and maintaining transparent academic review histories.",
    ],
    [
      "Energy Management in Academic Buildings",
      "Efficient energy management combines occupancy measurements with environmental sensing and building control systems. Academic facilities can evaluate electricity consumption patterns to identify practical improvements while maintaining appropriate comfort conditions for students and teaching staff.",
    ],
  ];
  for (const [title, text] of samples) {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const page = doc.addPage();
    let y = 760;
    for (const line of (
      "SYNTHETIC DEMONSTRATION DOCUMENT.\n" +
      text +
      "\n" +
      text
    ).match(/.{1,85}(?:\s|$)/g) || []) {
      page.drawText(line.trim(), { x: 35, y, size: 10, font });
      y -= 20;
    }
    const form = new FormData();
    Object.entries({
      title: "[DEMO] " + title,
      abstract:
        "Synthetic demonstration document for ThesisGuard evaluation. " + text,
      keywords: "demonstration, synthetic research",
      faculty_id: department.faculty_id,
      department_id: department.id,
      academic_year: "2026",
      status: "DRAFT",
    }).forEach(([k, v]) => form.set(k, v));
    form.set(
      "file",
      new File(
        [Buffer.from(await doc.save())],
        title.replaceAll(" ", "-") + ".pdf",
        { type: "application/pdf" },
      ),
    );
    const thesisId = await createThesis(form, user);
    console.log("Created synthetic draft:", thesisId);
  }
}
main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
