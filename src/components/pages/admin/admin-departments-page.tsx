import { Heading } from "@/components/ui";
import { ActionButton } from "@/components/action-button";
import { ManageForm } from "@/components/manage-form";
import { directories } from "@/lib/services/data";
import { LIMITATIONS } from "@/types";
export async function AdminDepartmentsPage() {
  const data = await directories();
  return (
    <>
      <Heading
        title="Faculties & departments"
        description="Organize research around your institution’s academic structure."
      />
      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        <div className="panel">
          <h2 className="text-xl">Add faculty</h2>
          <ManageForm
            url="/api/admin/faculties"
            method="POST"
            label="Add faculty"
            fields={[
              { name: "name", label: "Faculty name" },
              { name: "code", label: "Faculty code" },
            ]}
          />
        </div>
        <div className="panel">
          <h2 className="text-xl">Add department</h2>
          <ManageForm
            url="/api/admin/departments"
            method="POST"
            label="Add department"
            fields={[
              { name: "name", label: "Department name" },
              { name: "code", label: "Department code" },
              {
                name: "faculty_id",
                label: "Faculty",
                options: data.faculties.map((f) => ({
                  value: f.id,
                  label: f.name,
                })),
              },
            ]}
          />
        </div>
      </div>
      <div className="grid lg:grid-cols-2 gap-6">
        {(["faculties", "departments"] as const).map((kind) => (
          <div key={kind} className="space-y-5">
            <h2 className="text-xl capitalize">{kind}</h2>
            {data[kind].map((entry) => (
              <div key={entry.id} className="panel">
                <ManageForm
                  url={"/api/admin/" + kind}
                  extra={{ id: entry.id }}
                  fields={[
                    { name: "name", label: "Name", value: entry.name },
                    { name: "code", label: "Code", value: entry.code },
                    ...(kind === "departments"
                      ? [
                          {
                            name: "faculty_id",
                            label: "Faculty",
                            value: entry.faculty_id,
                            options: data.faculties.map((f) => ({
                              value: f.id,
                              label: f.name,
                            })),
                          },
                        ]
                      : []),
                  ]}
                />
                <div className="mt-4">
                  <ActionButton
                    url={"/api/admin/" + kind}
                    method="DELETE"
                    body={{ id: entry.id }}
                    label="Delete"
                    confirm="Delete this directory entry? Entries in use cannot be deleted."
                  />
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
      <p className="text-xs mt-6">{LIMITATIONS}</p>
    </>
  );
}
