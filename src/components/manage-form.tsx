"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button } from "@mui/material";
export interface Field {
  name: string;
  label: string;
  type?: string;
  value?: string | number | boolean | null;
  options?: { value: string; label: string }[];
  required?: boolean;
}
export function ManageForm({
  url,
  method = "PATCH",
  fields,
  label = "Save changes",
  extra = {},
}: {
  url: string;
  method?: string;
  fields: Field[];
  label?: string;
  extra?: Record<string, unknown>;
}) {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  const router = useRouter();
  return (
    <form
      className="space-y-5"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        setMessage("");
        const form = new FormData(e.currentTarget);
        const body: Record<string, unknown> = { ...extra };
        for (const f of fields)
          body[f.name] =
            f.type === "checkbox"
              ? form.get(f.name) === "on"
              : form.get(f.name);
        try {
          const response = await fetch(url, {
            method,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
          const data = await response.json();
          if (!response.ok) throw new Error(data.error);
          setMessage("Changes saved.");
          router.refresh();
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      {fields.map((f) => (
        <div key={f.name} className="field">
          {f.type === "checkbox" ? (
            <label className="flex gap-3 items-center">
              <input
                style={{ width: 16 }}
                type="checkbox"
                name={f.name}
                defaultChecked={Boolean(f.value)}
              />
              {f.label}
            </label>
          ) : (
            <>
              <label htmlFor={url + f.name}>{f.label}</label>
              {f.options ? (
                <select
                  id={url + f.name}
                  name={f.name}
                  defaultValue={String(f.value || "")}
                  required={f.required !== false}
                >
                  {f.options.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              ) : f.type === "textarea" ? (
                <textarea
                  id={url + f.name}
                  name={f.name}
                  defaultValue={String(f.value || "")}
                  required={f.required !== false}
                />
              ) : (
                <input
                  id={url + f.name}
                  name={f.name}
                  type={f.type || "text"}
                  defaultValue={String(f.value ?? "")}
                  required={f.required !== false}
                />
              )}
            </>
          )}
        </div>
      ))}
      {error && <Alert severity="error">{error}</Alert>}
      {message && <Alert severity="success">{message}</Alert>}
      <Button type="submit" variant="contained" disabled={busy}>
        {busy ? "Saving…" : label}
      </Button>
    </form>
  );
}
