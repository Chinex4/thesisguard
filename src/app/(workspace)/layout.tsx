import { configured } from "@/lib/config";
import { requirePage } from "@/lib/auth/session";
import { Shell } from "@/components/layout/shell";
import { Setup } from "@/components/ui";
export const dynamic = "force-dynamic";
export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!configured())
    return (
      <Shell user={null}>
        <Setup />
      </Shell>
    );
  const user = await requirePage();
  return <Shell user={user}>{children}</Shell>;
}
