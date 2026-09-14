"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Stepper,
  Step,
  StepLabel,
  Alert,
  CircularProgress,
} from "@mui/material";
import type { Scan } from "@/types";
const stages = [
  "QUEUED",
  "EXTRACTING",
  "SEARCHING_REPOSITORY",
  "SEARCHING_WEB",
  "SEARCHING_ACADEMIC",
  "COMPARING",
  "AI_ANALYSIS",
  "COMPLETED",
];
const labels = [
  "Waiting for scan worker",
  "Preparing document",
  "Checking thesis repository",
  "Searching public web",
  "Searching academic sources",
  "Comparing possible matches",
  "Analysing flagged passages",
  "Report ready",
];
export function ScanProgress({ initial }: { initial: Scan }) {
  const [scan, setScan] = useState(initial),
    [error, setError] = useState("");
  useEffect(() => {
    if (["COMPLETED", "FAILED"].includes(scan.status)) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const response = await fetch("/api/scans/" + initial.id, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error();
        setScan(await response.json());
        setError("");
      } catch {
        if (!controller.signal.aborted)
          setError("Connection interrupted. We will keep checking your scan.");
      }
      if (!controller.signal.aborted) timer = setTimeout(poll, 2500);
    }
    timer = setTimeout(poll, 2500);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [initial.id, scan.status]);
  return (
    <div className="panel max-w-3xl">
      <div className="flex gap-4 items-center mb-7">
        {!["COMPLETED", "FAILED"].includes(scan.status) && (
          <CircularProgress size={25} />
        )}
        <div>
          <h2 className="text-xl mb-1">
            {scan.status === "FAILED"
              ? "This scan needs another attempt"
              : scan.status === "COMPLETED"
                ? "Your report is ready"
                : "A careful check of your work"}
          </h2>
          <p className="text-sm mb-0">
            You can leave this page and come back. Progress is saved.
          </p>
        </div>
      </div>
      {error && <Alert severity="warning">{error}</Alert>}
      {scan.status === "FAILED" ? (
        <Alert severity="error">{scan.error_message}</Alert>
      ) : (
        <Stepper
          activeStep={stages.indexOf(scan.status)}
          orientation="vertical"
        >
          {labels.map((label, i) => (
            <Step key={label} completed={stages.indexOf(scan.status) > i}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>
      )}
      {scan.status === "QUEUED" && (
        <p className="text-xs mt-5">
          The scan worker will pick up your request. If it remains queued, ask
          your administrator to check that the worker is running.
        </p>
      )}
      {scan.status === "COMPLETED" && (
        <Link className="btn mt-6" href={"/reports/" + scan.id}>
          View similarity report
        </Link>
      )}
      {scan.status === "FAILED" && (
        <Link className="btn mt-6" href={"/theses/" + scan.thesis_id + "/scan"}>
          Start a new scan
        </Link>
      )}
    </div>
  );
}
