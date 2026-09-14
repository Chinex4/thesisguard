"use client";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Stepper,
  Step,
  StepLabel,
  Button,
  Alert,
  LinearProgress,
} from "@mui/material";
import { UploadCloud, FileText } from "lucide-react";
import { thesisSchema } from "@/lib/validations";
import {
  PdfTransfer,
  uploadApi,
  validatePdf,
  type UploadTicket,
} from "@/lib/uploads/client";
import { UploadError, logUploadFailure } from "@/lib/uploads/errors";
type Option = {
  id: string;
  name?: string;
  full_name?: string;
  faculty_id?: string;
};
export function UploadForm({
  faculties,
  departments,
  supervisors,
  maxSize = 20,
  versionOf = "",
}: {
  faculties: Option[];
  departments: Option[];
  supervisors: Option[];
  maxSize?: number;
  versionOf?: string;
}) {
  const [step, setStep] = useState(0),
    [file, setFile] = useState<File | null>(null),
    [drag, setDrag] = useState(false),
    [error, setError] = useState(""),
    [progress, setProgress] = useState<number | null>(null),
    [busy, setBusy] = useState(false),
    [uploaded, setUploaded] = useState(false);
  const router = useRouter();
  const {
    register,
    trigger,
    control,
    getValues,
    formState: { errors },
  } = useForm<
    z.input<typeof thesisSchema>,
    unknown,
    z.output<typeof thesisSchema>
  >({
    resolver: zodResolver(thesisSchema),
    defaultValues: {
      academic_year: new Date().getFullYear(),
      status: "DRAFT",
      version_of: versionOf,
      supervisor_id: "",
    },
  });
  const faculty = useWatch({ control, name: "faculty_id" });
  const transfer = useRef<PdfTransfer | null>(null);
  const locked = useRef(false);
  const preparation = useRef<AbortController | null>(null);
  useEffect(
    () => () => {
      preparation.current?.abort();
      void transfer.current?.cancel();
    },
    [],
  );
  async function choose(f: File | undefined) {
    if (locked.current || !f) return;
    setError("");
    setFile(null);
    setUploaded(false);
    const previous = transfer.current;
    transfer.current = null;
    if (previous) {
      await previous.cancel();
      void uploadApi(
        "/api/uploads",
        { path: previous.ticket.path },
        "DELETE",
      ).catch(() => {});
    }
    try {
      await validatePdf(f, maxSize);
      setFile(f);
    } catch (e) {
      setError(
        e instanceof UploadError
          ? e.message
          : "Unable to read the selected PDF.",
      );
    }
  }
  async function prepare() {
    if (!file || locked.current) return;
    locked.current = true;
    setBusy(true);
    setError("");
    setProgress(0);
    preparation.current = new AbortController();
    try {
      await validatePdf(file, maxSize);
      if (!transfer.current) {
        const ticket = await uploadApi<UploadTicket>(
          "/api/uploads",
          {
            name: file.name,
            size: file.size,
            metadata: getValues(),
          },
          "POST",
          preparation.current.signal,
        );
        transfer.current = new PdfTransfer(file, ticket);
      }
      if (preparation.current.signal.aborted)
        throw new UploadError("CANCELLED");
      await transfer.current.start(setProgress);
      setUploaded(true);
      setStep(2);
    } catch (e) {
      const failure = e instanceof UploadError ? e : new UploadError("SERVER");
      logUploadFailure("storage", failure);
      setError(failure.message);
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  async function upload(status: "DRAFT" | "SUBMITTED") {
    if (!transfer.current?.uploaded || locked.current) return;
    locked.current = true;
    setBusy(true);
    setError("");
    try {
      const data = await uploadApi<{ id: string }>("/api/theses", {
        path: transfer.current.ticket.path,
        metadata: { ...getValues(), status },
      });
      router.push("/theses/" + data.id);
      router.refresh();
    } catch (e) {
      const failure = e instanceof UploadError ? e : new UploadError("SERVER");
      logUploadFailure("finalization", failure);
      setError(failure.message);
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  return (
    <div className="panel max-w-4xl">
      <Stepper activeStep={step} alternativeLabel className="mb-10">
        {["Thesis information", "Document upload", "Review & submit"].map(
          (s) => (
            <Step key={s}>
              <StepLabel>{s}</StepLabel>
            </Step>
          ),
        )}
      </Stepper>
      {error && (
        <Alert severity="error" className="mb-5">
          {error}
        </Alert>
      )}
      {step === 0 && (
        <div className="form-grid">
          <div className="field full">
            <label htmlFor="title">Thesis title</label>
            <input
              id="title"
              {...register("title")}
              placeholder="Enter the full title of your research"
            />
            {errors.title && (
              <span className="field-error">{errors.title.message}</span>
            )}
          </div>
          <div className="field full">
            <label htmlFor="abstract">Abstract</label>
            <textarea
              id="abstract"
              {...register("abstract")}
              placeholder="Briefly describe the purpose, methods, and findings of your research."
            />
            {errors.abstract && (
              <span className="field-error">{errors.abstract.message}</span>
            )}
          </div>
          <div className="field full">
            <label htmlFor="keywords">
              Keywords <span className="muted">(separated by commas)</span>
            </label>
            <input
              id="keywords"
              {...register("keywords")}
              placeholder="e.g. machine learning, education, data privacy"
            />
          </div>
          <div className="field">
            <label htmlFor="faculty">Faculty</label>
            <select id="faculty" {...register("faculty_id")}>
              <option value="">Select faculty</option>
              {faculties.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
            {errors.faculty_id && (
              <span className="field-error">Select a faculty.</span>
            )}
          </div>
          <div className="field">
            <label htmlFor="department">Department</label>
            <select id="department" {...register("department_id")}>
              <option value="">Select department</option>
              {departments
                .filter((d) => d.faculty_id === faculty)
                .map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
            </select>
            {errors.department_id && (
              <span className="field-error">Select a department.</span>
            )}
          </div>
          <div className="field">
            <label htmlFor="year">Academic year</label>
            <input id="year" type="number" {...register("academic_year")} />
            {errors.academic_year && (
              <span className="field-error">Enter a valid year.</span>
            )}
          </div>
          <div className="field">
            <label htmlFor="supervisor">Supervisor</label>
            <select id="supervisor" {...register("supervisor_id")}>
              <option value="">Assign later</option>
              {supervisors.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
      {step === 1 && (
        <>
          <div
            className={"dropzone " + (drag ? "dragging" : "")}
            onDragOver={(e) => {
              e.preventDefault();
              setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDrag(false);
              choose(e.dataTransfer.files[0]);
            }}
          >
            <UploadCloud size={38} className="text-blue-800 mb-4" />
            <h3>Drop your thesis here</h3>
            <p className="text-sm">PDF · Up to {maxSize} MB</p>
            <label className="btn secondary cursor-pointer" htmlFor="document">
              Choose a document
            </label>
            <input
              className="sr-only"
              id="document"
              type="file"
              disabled={busy}
              accept=".pdf,application/pdf"
              onChange={(e) => {
                void choose(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </div>
          {file && (
            <div className="flex gap-3 items-center p-4 mt-4 rounded-lg bg-emerald-50">
              <FileText size={22} />
              <div className="grow">
                <b className="text-sm">{file.name}</b>
                <div className="text-xs muted">
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </div>
              </div>
              <span className="text-xs">
                {uploaded ? "Uploaded" : "Selected — not uploaded"}
              </span>
            </div>
          )}
          <p className="text-xs mt-5">
            Your file is stored privately. Image-only PDFs must be converted to
            searchable text before upload.
          </p>
        </>
      )}
      {step === 2 && (
        <div>
          <h2 className="text-xl">Ready for the next step</h2>
          <p className="text-sm">
            Save a private draft, or submit it for your supervisor to review.
          </p>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-5 bg-slate-50 rounded-lg p-6">
            {[
              ["Title", getValues("title")],
              ["Document", file?.name],
              [
                "File size",
                ((file?.size || 0) / 1024 / 1024).toFixed(2) + " MB",
              ],
              [
                "Department",
                departments.find((d) => d.id === getValues("department_id"))
                  ?.name,
              ],
              ["Academic year", String(getValues("academic_year"))],
              ["Access", "Private until approved"],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="text-xs muted">{k}</dt>
                <dd className="text-sm mt-1 break-words">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
      {busy && (
        <div className="mt-5" role="status">
          <LinearProgress
            variant={step === 2 ? "indeterminate" : "determinate"}
            value={progress || 0}
          />
          <p className="text-xs mt-2">
            {step === 2
              ? "Validating and saving your thesis…"
              : "Uploading PDF: " + progress + "%"}
          </p>
          {step === 1 && (
            <Button
              onClick={() => {
                preparation.current?.abort();
                void transfer.current?.cancel();
              }}
            >
              Cancel upload
            </Button>
          )}
        </div>
      )}
      <div className="flex justify-between gap-3 mt-8 pt-6 border-t border-slate-100">
        <Button disabled={step === 0 || busy} onClick={() => setStep(step - 1)}>
          Back
        </Button>
        {step < 2 ? (
          <Button
            variant="contained"
            disabled={busy}
            onClick={async () => {
              if (step === 0 && !(await trigger())) return;
              if (step === 1 && !file) {
                setError("Choose a document to continue.");
                return;
              }
              if (step === 1) {
                await prepare();
                return;
              }
              setError("");
              setStep(step + 1);
            }}
          >
            Continue
          </Button>
        ) : (
          <div className="flex gap-3">
            <Button
              disabled={busy}
              variant="outlined"
              onClick={() => upload("DRAFT")}
            >
              Save draft
            </Button>
            <Button
              disabled={busy}
              variant="contained"
              onClick={() => upload("SUBMITTED")}
            >
              Submit thesis
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
