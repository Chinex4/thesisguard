import { notFound } from "next/navigation";
import { requirePage } from "@/lib/auth/session";
import { configured } from "@/lib/config";
import { Setup } from "@/components/ui";
import { DashboardPage } from "@/components/pages/dashboard/dashboard-page";
import { RepositoryPage } from "@/components/pages/repository/repository-page";
import { ThesisListPage } from "@/components/pages/theses/thesis-list-page";
import { ThesisDetailPage } from "@/components/pages/theses/thesis-detail-page";
import { NewThesisPage } from "@/components/pages/theses/new-thesis-page";
import { ScanStartPage } from "@/components/pages/scans/scan-start-page";
import { ScanListPage } from "@/components/pages/scans/scan-list-page";
import { ScanDetailPage } from "@/components/pages/scans/scan-detail-page";
import { ProfilePage } from "@/components/pages/profile/profile-page";
import { AdminSettingsPage } from "@/components/pages/admin/admin-settings-page";
import { AdminUsersPage } from "@/components/pages/admin/admin-users-page";
import { AdminDepartmentsPage } from "@/components/pages/admin/admin-departments-page";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ section: string[] }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { section: s } = await params;
  const q = await searchParams;
  if (!configured()) return <Setup />;
  const user = await requirePage(
    s[0] === "admin"
      ? ["ADMIN"]
      : s[0] === "supervisor"
        ? ["SUPERVISOR", "ADMIN"]
        : undefined,
  );
  const route = s.join("/");
  if (["dashboard", "admin", "supervisor"].includes(route))
    return <DashboardPage user={user} />;
  if (route === "repository") return <RepositoryPage params={q} />;
  if (route === "theses/new")
    return <NewThesisPage user={user} version={q.version} />;
  if (["theses", "admin/theses", "supervisor/submissions"].includes(route))
    return (
      <ThesisListPage user={user} staff={s[0] === "supervisor"} params={q} />
    );
  if (["scans", "admin/scans"].includes(route)) return <ScanListPage />;
  if (route === "profile") return <ProfilePage user={user} />;
  if (route === "admin/settings") return <AdminSettingsPage />;
  if (route === "admin/users") return <AdminUsersPage />;
  if (route === "admin/departments") return <AdminDepartmentsPage />;
  if (s.length === 2 && s[0] === "repository")
    return <ThesisDetailPage id={s[1]} user={user} repository />;
  if (s.length === 2 && s[0] === "theses")
    return <ThesisDetailPage id={s[1]} user={user} />;
  if (s.length === 3 && s[0] === "theses" && s[2] === "scan")
    return <ScanStartPage id={s[1]} user={user} />;
  if (s.length === 3 && s[0] === "supervisor" && s[1] === "submissions")
    return <ThesisDetailPage id={s[2]} user={user} review />;
  if (s.length === 2 && ["scans", "reports"].includes(s[0]))
    return <ScanDetailPage id={s[1]} isReport={s[0] === "reports"} />;
  notFound();
}
