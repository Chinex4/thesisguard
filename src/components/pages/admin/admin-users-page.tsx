import { Heading } from "@/components/ui";
import { ManageForm } from "@/components/manage-form";
import { serverDb } from "@/lib/supabase/server";
export async function AdminUsersPage() {
  const db = await serverDb();
  const { data, error } = await db
    .from("profiles")
    .select("*")
    .order("full_name");
  if (error) throw new Error("Users unavailable.");
  return (
    <>
      <Heading
        title="Users & roles"
        description="Public registration creates student accounts. Assign staff access here."
      />
      <div className="grid lg:grid-cols-2 gap-5">
        {data?.map((p) => (
          <div className="panel" key={p.id}>
            <h3>{p.full_name}</h3>
            <p className="text-xs">
              {p.email} · {p.matric_number || "No matriculation number"}
            </p>
            <ManageForm
              url="/api/admin/users"
              extra={{ id: p.id }}
              label="Update role"
              fields={[
                {
                  name: "role",
                  label: "Account role",
                  value: p.role,
                  options: ["STUDENT", "SUPERVISOR", "ADMIN"].map((r) => ({
                    value: r,
                    label: r,
                  })),
                },
              ]}
            />
          </div>
        ))}
      </div>
    </>
  );
}
