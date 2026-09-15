import Link from "next/link";
import { Upload, ArrowRight, Library, ScanText, FileText } from "lucide-react";
import { Heading, Notice } from "@/components/ui";
import { ThesisTable } from "@/components/data-tables";
import { theses, scans, settings } from "@/lib/services/data";
import { serverDb } from "@/lib/supabase/server";
import { DISCLAIMER, type Profile } from "@/types";

export async function DashboardPage({ user }: { user: Profile }) {
  const [all, checks, config] = await Promise.all([
    theses(),
    scans(),
    settings(),
  ]);

  const own = all.filter(
    (t) =>
      user.role === "ADMIN" ||
      (user.role === "SUPERVISOR"
        ? t.supervisor_id === user.id
        : t.student_id === user.id),
  );
  const completed = checks.filter((s) => s.status === "COMPLETED");
  const pending = own.filter((t) =>
    ["SUBMITTED", "UNDER_REVIEW"].includes(t.status),
  );

  let userCount = 0;
  if (user.role === "ADMIN") {
    const db = await serverDb();
    const { count } = await db
      .from("profiles")
      .select("id", { head: true, count: "exact" });
    userCount = count || 0;
  }

  const stats =
    user.role === "STUDENT"
      ? [
          ["Theses", own.length],
          ["Latest status", own[0]?.status.replaceAll("_", " ") || "None"],
          [
            "Similarity",
            completed[0]
              ? completed[0].overall_similarity + "%"
              : "Not checked",
          ],
          [
            "Scans · 7 days",
            checks.filter(
              (s) =>
                new Date().getTime() - Date.parse(s.created_at) < 7 * 86400000,
            ).length,
          ],
        ]
      : user.role === "SUPERVISOR"
        ? [
            ["Pending", pending.length],
            ["Students", new Set(own.map((t) => t.student_id)).size],
            ["Submissions", own.length],
            [
              "High similarity",
              completed.filter(
                (s) => s.overall_similarity >= config.similarity_high_threshold,
              ).length,
            ],
          ]
        : [
            ["Users", userCount],
            ["Theses", all.length],
            ["Approved", all.filter((t) => t.status === "APPROVED").length],
            ["Scans", checks.length],
            [
              "Avg. similarity",
              completed.length
                ? (
                    completed.reduce(
                      (s, c) => s + Number(c.overall_similarity),
                      0,
                    ) / completed.length
                  ).toFixed(1) + "%"
                : "Not checked",
            ],
            ["Awaiting review", pending.length],
          ];

  return (
    <>
      <Heading
        title={"Welcome, " + user.full_name.split(" ")[0]}
        description={
          user.role === "STUDENT"
            ? "Your research at a glance."
            : "Research activity at a glance."
        }
      >
        {user.role === "STUDENT" && (
          <Link className="btn" href="/theses/new">
            <Upload size={16} /> Upload thesis
          </Link>
        )}
      </Heading>

      <div
        className={
          "dashboard-stats grid " +
          (user.role === "ADMIN" ? "lg:grid-cols-3" : "lg:grid-cols-4")
        }
      >
        {stats.map(([label, value]) => (
          <div className="stat" key={label}>
            <p>{label}</p>
            <b className={String(value).length > 15 ? "stat-value-small" : ""}>
              {value}
            </b>
          </div>
        ))}
      </div>

      {user.role === "STUDENT" && (
        <div className="dashboard-prompt panel">
          <div className="step-icon mb-0 shrink-0">
            <ScanText size={24} />
          </div>
          <div className="grow min-w-0">
            <h2>Check before you submit.</h2>
            <p>Review matching text and citations.</p>
          </div>
          <Link className="btn secondary" href="/theses">
            Run a check <ArrowRight size={15} />
          </Link>
        </div>
      )}

      <div className="panel mb-7">
        <div className="section-title">
          <h2>
            {user.role === "STUDENT" ? "Recent theses" : "Recent submissions"}
          </h2>
          <Link
            className="text-xs text-blue-800"
            href={
              user.role === "SUPERVISOR"
                ? "/supervisor/submissions"
                : user.role === "ADMIN"
                  ? "/admin/theses"
                  : "/theses"
            }
          >
            View all →
          </Link>
        </div>
        <ThesisTable
          items={own.slice(0, 5)}
          base={
            user.role === "SUPERVISOR" ? "/supervisor/submissions" : "/theses"
          }
        />
      </div>

      <div className="dashboard-links">
        <Link href="/repository" className="panel dashboard-link-card">
          <Library className="text-blue-800 shrink-0" />
          <div className="min-w-0">
            <h3>Repository</h3>
            <p>Browse approved research.</p>
          </div>
        </Link>
        <Link href="/scans" className="panel dashboard-link-card">
          <FileText className="text-emerald-700 shrink-0" />
          <div className="min-w-0">
            <h3>Similarity reports</h3>
            <p>Review matches and sources.</p>
          </div>
        </Link>
      </div>

      <Notice>{DISCLAIMER}</Notice>
    </>
  );
}
