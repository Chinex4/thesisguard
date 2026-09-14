import { notFound } from "next/navigation";
import { Heading, Notice } from "@/components/ui";
import { ActionButton } from "@/components/action-button";
import { thesis } from "@/lib/services/data";
import { DISCLAIMER, type Profile } from "@/types";
export async function ScanStartPage({
  id,
  user,
}: {
  id: string;
  user: Profile;
}) {
  const t = await thesis(id);
  if (
    !t ||
    !(
      user.role === "ADMIN" ||
      t.student_id === user.id ||
      t.supervisor_id === user.id
    )
  )
    notFound();
  return (
    <>
      <Heading
        title="Check your thesis"
        description="A transparent comparison against the sources available to your institution."
      />
      <div className="panel max-w-3xl">
        <h2 className="text-xl">{t.title}</h2>
        <p className="text-sm">
          {t.word_count.toLocaleString()} words · {t.original_filename}
        </p>
        <div className="space-y-4 my-7">
          <p className="text-sm">
            We will check approved repository passages, selected public web
            sources, and academic abstracts or openly accessible papers.
            Reference lists are excluded from the score.
          </p>
          <p className="text-sm">
            Distinctive passages are sent to the configured search providers.
            Flagged excerpts may be sent to DeepSeek for citation guidance. Your
            entire thesis is not sent to the AI service.
          </p>
          <Notice>{DISCLAIMER}</Notice>
        </div>
        <ActionButton
          url={"/api/theses/" + id + "/scan"}
          label="Start similarity check"
          redirectTo="/scans/:id"
        />
      </div>
    </>
  );
}
