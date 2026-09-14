"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@mui/material";
export function ActionButton({
  url,
  label,
  method = "POST",
  body,
  redirectTo,
  confirm,
}: {
  url: string;
  label: string;
  method?: string;
  body?: unknown;
  redirectTo?: string;
  confirm?: string;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [open, setOpen] = useState(false);
  const router = useRouter();
  async function run() {
    setOpen(false);
    setBusy(true);
    setError("");
    try {
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      if (redirectTo) router.push(redirectTo.replace(":id", data.id));
      else router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div>
      <Button
        variant="outlined"
        disabled={busy}
        onClick={() => (confirm ? setOpen(true) : run())}
      >
        {busy ? "Working…" : label}
      </Button>
      {error && (
        <Alert severity="error" className="mt-2">
          {error}
        </Alert>
      )}
      <Dialog open={open} onClose={() => setOpen(false)}>
        <DialogTitle>{label}</DialogTitle>
        <DialogContent>{confirm}</DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={run} color="error">
            Confirm
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
