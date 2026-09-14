import { Heading } from "@/components/ui";
import { ManageForm } from "@/components/manage-form";
import { type Profile } from "@/types";
export async function ProfilePage({ user }: { user: Profile }) {
  return (
    <>
      <Heading
        title="Your profile"
        description="Keep your academic details up to date."
      />
      <div className="panel max-w-2xl">
        <p className="text-sm mb-6">
          {user.email} · {user.role.toLowerCase()} account
        </p>
        <ManageForm
          url="/api/profile"
          fields={[
            { name: "full_name", label: "Full name", value: user.full_name },
            {
              name: "matric_number",
              label: "Matriculation number",
              value: user.matric_number,
              required: false,
            },
          ]}
        />
      </div>
    </>
  );
}
