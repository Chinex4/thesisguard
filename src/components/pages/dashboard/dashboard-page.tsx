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
          ["My theses", own.length],
          [
            "Latest submission",
            own[0]?.status.replaceAll("_", " ") || "No submissions",
          ],
          [
            "Latest similarity",
            completed[0]
              ? completed[0].overall_similarity + "%"
              : "Not checked",
          ],
          [
            "Scans this week",
            checks.filter(
              (s) =>
                new Date().getTime() - Date.parse(s.created_at) < 7 * 86400000,
            ).length,
          ],
        ]
      : user.role === "SUPERVISOR"
        ? [
            ["Pending reviews", pending.length],
            ["Assigned students", new Set(own.map((t) => t.student_id)).size],
            ["Submissions", own.length],
            [
              "Reports requiring attention",
              completed.filter(
                (s) => s.overall_similarity >= config.similarity_high_threshold,
              ).length,
            ],
          ]
        : [
            ["Total users", userCount],
            ["Total theses", all.length],
            [
              "Approved theses",
              all.filter((t) => t.status === "APPROVED").length,
            ],
            ["Scans performed", checks.length],
            [
              "Average similarity",
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
        title={"Welcome back, " + user.full_name.split(" ")[0]}
        description={
          user.role === "STUDENT"
            ? "A little clarity for every step of your research."
            : "Your institution’s research, ready for review."
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
          "grid grid-cols-2 " +
          (user.role === "ADMIN" ? "lg:grid-cols-3" : "lg:grid-cols-4") +
          " gap-4 mb-7"
        }
      >
        {stats.map(([label, value]) => (
          <div className="stat" key={label}>
            <p>{label}</p>
            <b style={{ fontSize: String(value).length > 15 ? 18 : 30 }}>
              {value}
            </b>
          </div>
        ))}
      </div>
      {user.role === "STUDENT" && (
        <div className="panel mb-7 flex flex-col sm:flex-row items-start sm:items-center gap-6 bg-blue-50/40!">
          <div className="step-icon mb-0 shrink-0">
            <ScanText size={25} />
          </div>
          <div className="grow">
            <h2 className="text-xl mb-2">
              Make your next submission your best.
            </h2>
            <p className="text-sm mb-0">
              Understand matching content and give every source the credit it
              deserves.
            </p>
          </div>
          <Link className="btn secondary whitespace-nowrap" href="/theses">
            Run a similarity check <ArrowRight size={15} />
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
      <div className="grid md:grid-cols-2 gap-5 mb-7">
        <Link href="/repository" className="panel flex gap-4">
          <Library className="text-blue-800 shrink-0" />
          <div>
            <h3 className="mb-2">Explore the repository</h3>
            <p className="text-sm mb-0">
              Build on approved research from your institution.
            </p>
          </div>
        </Link>
        <Link href="/scans" className="panel flex gap-4">
          <FileText className="text-emerald-700 shrink-0" />
          <div>
            <h3 className="mb-2">Your similarity reports</h3>
            <p className="text-sm mb-0">
              Revisit source evidence and academic integrity guidance.
            </p>
          </div>
        </Link>
      </div>
      <Notice>{DISCLAIMER}</Notice>
    </>
  );
}
