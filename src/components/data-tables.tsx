import Link from "next/link";
import { Badge, Empty } from "@/components/ui";
import type { Thesis, Scan } from "@/types";
export function ThesisTable({
  items,
  base = "/theses",
}: {
  items: Thesis[];
  base?: string;
}) {
  if (!items.length)
    return (
      <Empty
        title="No theses here yet"
        description="New submissions will appear here when they are available."
      />
    );
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Thesis / Student</th>
            <th>Department</th>
            <th>Year</th>
            <th>Status</th>
            <th>Added</th>
          </tr>
        </thead>
        <tbody>
          {items.map((t) => (
            <tr key={t.id}>
              <td className="min-w-64 max-w-lg">
                <Link className="font-semibold" href={base + "/" + t.id}>
                  {t.title}
                </Link>
                <div className="muted text-xs mt-1">{t.student?.full_name}</div>
              </td>
              <td>{t.department?.name}</td>
              <td>{t.academic_year}</td>
              <td>
                <Badge status={t.status} />
              </td>
              <td className="whitespace-nowrap">
                {new Date(t.created_at).toLocaleDateString("en-GB")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export function ScanTable({ items }: { items: Scan[] }) {
  if (!items.length)
    return (
      <Empty
        title="Your similarity checks will appear here"
        description="Open a thesis and run a check to see matching sources and practical citation guidance."
        href="/theses"
        label="Choose a thesis"
      />
    );
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Thesis</th>
            <th>Status</th>
            <th>Similarity</th>
            <th>Date checked</th>
            <th>Report</th>
          </tr>
        </thead>
        <tbody>
          {items.map((s) => (
            <tr key={s.id}>
              <td className="min-w-64 font-medium">
                <Link href={"/scans/" + s.id}>{s.thesis?.title}</Link>
              </td>
              <td>
                <Badge status={s.status} />
              </td>
              <td>
                {s.status === "COMPLETED" ? s.overall_similarity + "%" : "—"}
              </td>
              <td className="whitespace-nowrap">
                {new Date(s.created_at).toLocaleDateString("en-GB")}
              </td>
              <td>
                <Link
                  className="text-blue-800"
                  href={
                    (s.status === "COMPLETED" ? "/reports/" : "/scans/") + s.id
                  }
                >
                  {s.status === "COMPLETED" ? "View report" : "View progress"}
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
