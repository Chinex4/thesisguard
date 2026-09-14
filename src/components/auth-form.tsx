"use client";
import { useState } from "react";
import Link from "next/link";
import { Alert, Button } from "@mui/material";
import { authAction, resetPassword } from "@/lib/auth/actions";
type Directory = { id: string; name: string; faculty_id?: string };
export function AuthForm({
  mode,
  configured,
  faculties = [],
  departments = [],
}: {
  mode: string;
  configured: boolean;
  faculties?: Directory[];
  departments?: Directory[];
}) {
  const [faculty, setFaculty] = useState("");
  const [result, setResult] = useState<{ error?: string; success?: string }>(
    {},
  );
  const [pending, setPending] = useState(false);
  const register = mode === "register",
    reset = mode === "reset-password",
    forgot = mode === "forgot-password";
  return (
    <>
      {!configured && (
        <Alert severity="info" className="mb-6">
          Account services are not connected yet. Configure Supabase using the
          project README to enable sign-in.
        </Alert>
      )}
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setPending(true);
          setResult({});
          try {
            setResult(
              reset
                ? await resetPassword(new FormData(e.currentTarget))
                : await authAction(mode, new FormData(e.currentTarget)),
            );
          } catch {
            setResult({
              error: "The request could not be completed. Try again.",
            });
          } finally {
            setPending(false);
          }
        }}
      >
        {register && (
          <div className="field">
            <label htmlFor="full_name">Full name</label>
            <input
              id="full_name"
              name="full_name"
              required
              autoComplete="name"
              minLength={3}
            />
          </div>
        )}
        {!reset && (
          <div className="field">
            <label htmlFor="email">Institutional email</label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="you@institution.edu"
            />
          </div>
        )}
        {!forgot && (
          <div className="field">
            <div className="flex justify-between">
              <label htmlFor="password">Password</label>
              {!register && !reset && (
                <Link className="text-xs text-blue-800" href="/forgot-password">
                  Forgot password?
                </Link>
              )}
            </div>
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={register || reset ? 10 : 1}
              autoComplete={
                register || reset ? "new-password" : "current-password"
              }
            />
            {(register || reset) && (
              <small className="muted">Use at least 10 characters.</small>
            )}
          </div>
        )}
        {(register || reset) && (
          <div className="field">
            <label htmlFor="confirmPassword">Confirm password</label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              required
              autoComplete="new-password"
            />
          </div>
        )}
        {register && (
          <>
            <div className="field">
              <label htmlFor="matric_number">Matriculation number</label>
              <input
                id="matric_number"
                name="matric_number"
                required
                minLength={3}
              />
            </div>
            <div className="form-grid">
              <div className="field">
                <label htmlFor="faculty_id">Faculty</label>
                <select
                  id="faculty_id"
                  name="faculty_id"
                  required
                  value={faculty}
                  onChange={(e) => setFaculty(e.target.value)}
                >
                  <option value="">Choose faculty</option>
                  {faculties.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="department_id">Department</label>
                <select
                  id="department_id"
                  name="department_id"
                  required
                  key={faculty}
                >
                  <option value="">Choose department</option>
                  {departments
                    .filter((d) => d.faculty_id === faculty)
                    .map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                </select>
              </div>
            </div>
            <p className="text-xs mb-0">
              Public accounts are student accounts. Your institution assigns
              staff access.
            </p>
          </>
        )}
        {result.error && <Alert severity="error">{result.error}</Alert>}
        {result.success && <Alert severity="success">{result.success}</Alert>}
        <Button
          variant="contained"
          type="submit"
          disabled={!configured || pending}
          size="large"
        >
          {pending
            ? "Please wait…"
            : register
              ? "Create student account"
              : forgot
                ? "Send reset link"
                : reset
                  ? "Update password"
                  : "Sign in"}
        </Button>
      </form>
      <p className="text-sm text-center mt-6">
        {register
          ? "Already have an account? "
          : forgot || reset
            ? "Back to your account? "
            : "New to ThesisGuard? "}
        <Link
          className="text-blue-800 font-semibold"
          href={register || forgot || reset ? "/login" : "/register"}
        >
          {register || forgot || reset ? "Sign in" : "Create an account"}
        </Link>
      </p>
    </>
  );
}
