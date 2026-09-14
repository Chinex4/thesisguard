import Link from "next/link";
import { Upload } from "lucide-react";
import { Heading } from "@/components/ui";
import { ThesisTable } from "@/components/data-tables";
import { theses, scans, directories } from "@/lib/services/data";
import { type Profile } from "@/types";
export async function ThesisListPage({
  user,
  staff = false,
  params = {},
}: {
  user: Profile;
  staff?: boolean;
  params?: Record<string, string | undefined>;
}) {
  const [all, checks] = await Promise.all([theses(), scans()]);
  const q = (params.q || "").toLowerCase();
  const items = all.filter(
    (t) =>
      (user.role === "ADMIN" ||
        (staff ? t.supervisor_id === user.id : t.student_id === user.id)) &&
      (!q ||
        (t.title + " " + t.student?.full_name).toLowerCase().includes(q)) &&
      (!params.year || t.academic_year === Number(params.year)) &&
      (!params.department || t.department_id === params.department) &&
      (!params.minScore ||
        checks.some(
          (s) =>
            s.thesis_id === t.id &&
            s.status === "COMPLETED" &&
            s.overall_similarity >= Number(params.minScore),
        )),
  );
  const directory = staff || user.role === "ADMIN" ? await directories() : null;
  return (
    <>
      <Heading
        title={
          staff
            ? "Student submissions"
            : user.role === "ADMIN"
              ? "Manage theses"
              : "My theses"
        }
        description="Keep track of drafts, submissions, and feedback."
      >
        {user.role === "STUDENT" && (
          <Link className="btn" href="/theses/new">
            <Upload size={16} /> Upload thesis
          </Link>
        )}
      </Heading>
      <div className="panel">
        {directory && (
          <form className="filters">
            <input
              className="filter-input"
              name="q"
              aria-label="Title or student"
              placeholder="Title or student"
              defaultValue={params.q}
            />
            <select
              className="filter-input"
              name="department"
              aria-label="Department"
              defaultValue={params.department || ""}
            >
              <option value="">All departments</option>
              {directory.departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
            <input
              className="filter-input"
              name="year"
              type="number"
              aria-label="Year"
              placeholder="Year"
              defaultValue={params.year}
            />
            <input
              className="filter-input"
              name="minScore"
              type="number"
              min="0"
              max="100"
              aria-label="Minimum similarity"
              placeholder="Minimum similarity %"
              defaultValue={params.minScore}
            />
            <button className="btn">Filter</button>
          </form>
        )}
        <ThesisTable
          items={items}
          base={staff ? "/supervisor/submissions" : "/theses"}
        />
      </div>
    </>
  );
}
