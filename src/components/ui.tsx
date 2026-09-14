import Link from "next/link";
import { ShieldCheck, FileText, Info } from "lucide-react";
export function Brand() {
  return (
    <Link href="/" className="brand" aria-label="ThesisGuard home">
      <span className="brand-icon">
        <ShieldCheck size={22} />
      </span>
      <span>
        Thesis<span>Guard</span>
      </span>
    </Link>
  );
}
export function Badge({ status }: { status: string }) {
  const tone = ["APPROVED", "COMPLETED"].includes(status)
    ? "green"
    : ["SUBMITTED", "UNDER_REVIEW", "REJECTED", "FAILED"].includes(status)
      ? "amber"
      : "";
  return <span className={"badge " + tone}>{status.replaceAll("_", " ")}</span>;
}
export function Empty({
  title,
  description,
  href,
  label,
}: {
  title: string;
  description: string;
  href?: string;
  label?: string;
}) {
  return (
    <div className="empty">
      <FileText size={34} />
      <h3>{title}</h3>
      <p>{description}</p>
      {href && (
        <Link className="btn" href={href}>
          {label}
        </Link>
      )}
    </div>
  );
}
export function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div className="notice">
      <Info size={18} className="shrink-0 mt-0.5" />
      <div>{children}</div>
    </div>
  );
}
export function Heading({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <h1 className="mb-2">{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {children}
    </div>
  );
}
export function Setup() {
  return (
    <div className="panel">
      <Empty
        title="Connect your institution"
        description="ThesisGuard is ready for configuration. Connect Supabase to enable accounts, the thesis repository, and similarity reports."
      />
      <Notice>
        Add the Supabase URL, public key, and server service-role key to{" "}
        <code>.env.local</code>, then apply the migration and seed in{" "}
        <code>supabase/</code>. The README contains the setup steps. No sample
        results are presented as real scans.
      </Notice>
    </div>
  );
}
