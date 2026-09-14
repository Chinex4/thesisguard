import { Heading, Notice } from "@/components/ui";
import { ManageForm } from "@/components/manage-form";
import { settings } from "@/lib/services/data";
export async function AdminSettingsPage() {
  const config = await settings();
  return (
    <>
      <Heading
        title="Institution settings"
        description="Set review indicators and sensible limits for your institution."
      />
      <div className="panel max-w-3xl">
        <Notice>
          These thresholds guide review at your institution. They are not
          universal academic rules or misconduct verdicts.
        </Notice>
        <div className="mt-6">
          <ManageForm
            url="/api/admin/settings"
            fields={[
              {
                name: "similarity_warning_threshold",
                label: "Similarity warning threshold (%)",
                type: "number",
                value: config.similarity_warning_threshold,
              },
              {
                name: "similarity_high_threshold",
                label: "High similarity threshold (%)",
                type: "number",
                value: config.similarity_high_threshold,
              },
              {
                name: "maximum_file_size",
                label: "Maximum upload size (MB, up to 20)",
                type: "number",
                value: config.maximum_file_size,
              },
              {
                name: "maximum_daily_scans",
                label: "Maximum scans per user per UTC day",
                type: "number",
                value: config.maximum_daily_scans,
              },
              {
                name: "external_search_enabled",
                label: "Enable public web source discovery",
                type: "checkbox",
                value: config.external_search_enabled,
              },
              {
                name: "academic_search_enabled",
                label: "Enable academic source discovery",
                type: "checkbox",
                value: config.academic_search_enabled,
              },
              {
                name: "allow_student_resubmission",
                label: "Allow revised versions of drafts and rejected theses",
                type: "checkbox",
                value: config.allow_student_resubmission,
              },
            ]}
          />
        </div>
      </div>
    </>
  );
}
