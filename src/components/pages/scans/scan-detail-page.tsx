import { notFound } from "next/navigation";
import { Heading } from "@/components/ui";
import { ScanProgress } from "@/components/scan/progress";
import { ReportView } from "@/components/report/report-view";
import { report } from "@/lib/services/data";
export async function ScanDetailPage({
  id,
  isReport = false,
}: {
  id: string;
  isReport?: boolean;
}) {
  const data = await report(id);
  if (!data) notFound();
  if (isReport && data.scan.status === "COMPLETED")
    return <ReportView {...data} />;
  return (
    <>
      <Heading title="Similarity check" description={data.scan.thesis?.title} />
      <ScanProgress initial={data.scan} />
    </>
  );
}
