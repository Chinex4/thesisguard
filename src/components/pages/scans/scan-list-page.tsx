import { Heading } from "@/components/ui";
import { ScanTable } from "@/components/data-tables";
import { scans } from "@/lib/services/data";
export async function ScanListPage() {
  return (
    <>
      <Heading
        title="Similarity checks"
        description="Track progress and revisit the evidence behind each report."
      />
      <div className="panel">
        <ScanTable items={await scans()} />
      </div>
    </>
  );
}
