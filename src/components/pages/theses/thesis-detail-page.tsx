import Link from "next/link";
import { notFound } from "next/navigation";
import { Heading, Badge } from "@/components/ui";
import { ScanTable } from "@/components/data-tables";
import { ActionButton } from "@/components/action-button";
import { ManageForm } from "@/components/manage-form";
import { thesis, settings, directories } from "@/lib/services/data";
import { serverDb } from "@/lib/supabase/server";
import { type Profile } from "@/types";
export async function ThesisDetailPage({
  id,
  user,
  repository = false,
  review = false,
}: {
  id: string;
  user: Profile;
  repository?: boolean;
  review?: boolean;
}) {
  const t = await thesis(id);
  if (!t || (repository && t.status !== "APPROVED")) notFound();
  if (review && user.role !== "ADMIN" && t.supervisor_id !== user.id)
    notFound();
  const privateAccess =
    user.role === "ADMIN" ||
    t.student_id === user.id ||
    t.supervisor_id === user.id;
  const db = await serverDb();
  const [checks, reviews, versions] = privateAccess
    ? await Promise.all([
        db
          .from("plagiarism_scans")
          .select("*,thesis:theses(title)")
          .eq("thesis_id", id)
          .order("created_at", { ascending: false }),
        db
          .from("supervisor_reviews")
          .select(
            "*,supervisor:profiles!supervisor_reviews_supervisor_id_fkey(full_name)",
          )
          .eq("thesis_id", id)
          .order("created_at", { ascending: false }),
        db
          .from("theses")
          .select("id,title,created_at,status")
          .eq("version_of", t.version_of || id),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }];
  const canReview =
    (user.role === "ADMIN" ||
      (user.role === "SUPERVISOR" && t.supervisor_id === user.id)) &&
    ["SUBMITTED", "UNDER_REVIEW"].includes(t.status);
  const config = await settings();
  const directory = user.role === "ADMIN" ? await directories() : null;
  return (
    <>
      <Heading
        title={repository ? "Research details" : "Thesis details"}
        description={
          repository
            ? "Approved institutional research."
            : "Your document, submission history, and next steps."
        }
      >
        <a className="btn secondary" href={"/api/documents/" + id}>
          Download document
        </a>
      </Heading>
      <div className="panel mb-6">
        <Badge status={t.status} />
        <h2 className="mt-5 mb-4">{t.title}</h2>
        <p className="text-sm">
          {t.student?.full_name} · {t.department?.name} · {t.academic_year}
        </p>
        <div className="grid sm:grid-cols-3 gap-5 border-y border-slate-100 py-5 my-6">
          {[
            ["Faculty", t.faculty?.name],
            ["Supervisor", t.supervisor?.full_name || "Not assigned"],
            [
              "Document",
              t.original_filename +
                " · " +
                (t.file_size / 1024 / 1024).toFixed(2) +
                " MB",
            ],
          ].map(([k, v]) => (
            <div key={k}>
              <div className="text-xs muted">{k}</div>
              <div className="text-sm mt-1 break-words">{v}</div>
            </div>
          ))}
        </div>
        <h3>Abstract</h3>
        <p className="text-sm whitespace-pre-wrap">{t.abstract}</p>
        <div className="flex gap-2 flex-wrap">
          {t.keywords.map((k) => (
            <span className="badge" key={k}>
              {k}
            </span>
          ))}
        </div>
        <div className="flex gap-3 flex-wrap mt-7">
          {privateAccess && t.status !== "ARCHIVED" && (
            <Link className="btn" href={"/theses/" + id + "/scan"}>
              Run similarity check
            </Link>
          )}
          {t.student_id === user.id && t.status === "DRAFT" && (
            <ActionButton
              url={"/api/theses/" + id}
              method="PATCH"
              body={{ status: "SUBMITTED" }}
              label="Submit for review"
            />
          )}
          {t.student_id === user.id &&
            ["DRAFT", "REJECTED"].includes(t.status) &&
            config.allow_student_resubmission && (
              <Link
                className="btn secondary"
                href={"/theses/new?version=" + id}
              >
                Upload revised version
              </Link>
            )}
          {user.role === "ADMIN" && t.status !== "ARCHIVED" && (
            <ActionButton
              url={"/api/theses/" + id}
              method="PATCH"
              body={{ status: "ARCHIVED" }}
              label="Archive thesis"
              confirm="Archive this thesis? It will be removed from the approved repository."
            />
          )}
          {user.role === "ADMIN" &&
            ["ARCHIVED", "DRAFT"].includes(t.status) && (
              <ActionButton
                url={"/api/theses/" + id}
                method="DELETE"
                label="Delete thesis"
                confirm="Permanently delete this thesis, its document, scans, and reviews?"
                redirectTo="/admin/theses"
              />
            )}
        </div>
      </div>
      {canReview && (
        <div className="panel mb-6">
          <h2 className="text-xl">Academic review</h2>
          <p className="text-sm">
            Review the source evidence before deciding. Similarity thresholds
            are institution-specific indicators.
          </p>
          <ManageForm
            url={"/api/theses/" + id + "/review"}
            method="POST"
            label="Save review"
            fields={[
              {
                name: "decision",
                label: "Decision",
                options: [
                  { value: "UNDER_REVIEW", label: "Keep under review" },
                  { value: "APPROVED", label: "Approve for repository" },
                  { value: "REJECTED", label: "Request revision" },
                ],
              },
              { name: "comment", label: "Review comments", type: "textarea" },
            ]}
          />
        </div>
      )}
      {directory && (
        <div className="panel mb-6">
          <h3>Supervisor assignment</h3>
          <ManageForm
            url="/api/admin/assignment"
            extra={{ thesis_id: id }}
            fields={[
              {
                name: "supervisor_id",
                label: "Supervisor",
                value: t.supervisor_id,
                options: directory.supervisors.map((s) => ({
                  value: s.id,
                  label: s.full_name,
                })),
              },
            ]}
          />
        </div>
      )}
      {privateAccess && (
        <>
          <div className="panel mb-6">
            <h2 className="text-xl">Similarity history</h2>
            <ScanTable items={checks.data || []} />
          </div>
          <div className="panel mb-6">
            <h2 className="text-xl">Review history</h2>
            {reviews.data?.length ? (
              reviews.data.map((r) => (
                <div key={r.id} className="border-b border-slate-100 py-4">
                  <Badge status={r.decision} />
                  <p className="text-sm mt-3 mb-1 whitespace-pre-wrap">
                    {r.comment}
                  </p>
                  <span className="text-xs muted">
                    {r.supervisor?.full_name} ·{" "}
                    {new Date(r.created_at).toLocaleDateString("en-GB")}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-sm mb-0">No review comments yet.</p>
            )}
          </div>
          {(t.version_of || Boolean(versions.data?.length)) && (
            <div className="panel">
              <h3>Submission versions</h3>
              {t.version_of && (
                <Link
                  className="text-blue-800 block text-sm mb-3"
                  href={"/theses/" + t.version_of}
                >
                  View original submission
                </Link>
              )}
              {versions.data?.map((v) => (
                <Link
                  key={v.id}
                  className="block text-sm text-blue-800 py-2"
                  href={"/theses/" + v.id}
                >
                  {v.title} ·{" "}
                  {new Date(v.created_at).toLocaleDateString("en-GB")}
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}
