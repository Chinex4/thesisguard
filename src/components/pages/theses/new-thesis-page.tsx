import { redirect } from "next/navigation";
import { Heading } from "@/components/ui";
import { UploadForm } from "@/components/thesis/upload-form";
import { settings, directories } from "@/lib/services/data";
import { type Profile } from "@/types";
export async function NewThesisPage({
  user,
  version,
}: {
  user: Profile;
  version?: string;
}) {
  if (user.role !== "STUDENT") redirect("/dashboard");
  const [directory, config] = await Promise.all([directories(), settings()]);
  return (
    <>
      <Heading
        title={version ? "Upload a revised thesis" : "Upload your thesis"}
        description="A safe home for your research. Start with a few details."
      />
      <UploadForm
        {...directory}
        maxSize={config.maximum_file_size}
        versionOf={version}
      />
    </>
  );
}
