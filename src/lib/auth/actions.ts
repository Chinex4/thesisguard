"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { serverDb } from "@/lib/supabase/server";
import { registerSchema } from "@/lib/validations";
export async function authAction(
  mode: string,
  form: FormData,
): Promise<{ error?: string; success?: string }> {
  try {
    const db = await serverDb();
    const email = z.email().parse(form.get("email"));
    const site = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    if (mode === "register") {
      const values = registerSchema.parse(Object.fromEntries(form));
      const { data: dep } = await db
        .from("departments")
        .select("faculty_id")
        .eq("id", values.department_id)
        .single();
      if (dep?.faculty_id !== values.faculty_id)
        return { error: "Select a department in your faculty." };
      const { password, confirmPassword, ...metadata } = values;
      void confirmPassword;
      const { error } = await db.auth.signUp({
        email,
        password,
        options: { data: metadata, emailRedirectTo: site + "/auth/callback" },
      });
      if (error)
        return {
          error:
            "Registration could not be completed. Check your details or try signing in.",
        };
      return {
        success:
          "Account request received. Check your email to confirm your account, then sign in.",
      };
    }
    if (mode === "forgot-password") {
      const { error } = await db.auth.resetPasswordForEmail(email, {
        redirectTo: site + "/auth/callback?next=/reset-password",
      });
      if (error)
        return {
          error: "Password reset is temporarily unavailable. Please try again.",
        };
      return {
        success: "If an account exists, a password reset link has been sent.",
      };
    }
    const password = z.string().min(1).parse(form.get("password"));
    const { error } = await db.auth.signInWithPassword({ email, password });
    if (error)
      return {
        error:
          "Email or password is incorrect, or your email has not been confirmed.",
      };
  } catch (e) {
    return {
      error:
        e instanceof z.ZodError
          ? e.issues[0].message
          : "Authentication is unavailable. Check the Supabase configuration.",
    };
  }
  redirect("/dashboard");
}
export async function signOut() {
  const db = await serverDb();
  await db.auth.signOut();
  redirect("/login");
}
export async function resetPassword(form: FormData) {
  const password = z.string().min(10).max(128).safeParse(form.get("password"));
  if (!password.success) return { error: "Use at least 10 characters." };
  if (password.data !== form.get("confirmPassword"))
    return { error: "Passwords must match." };
  const db = await serverDb();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user)
    return { error: "This link has expired. Request a new password reset." };
  const { error } = await db.auth.updateUser({ password: password.data });
  return error
    ? { error: "Could not update your password." }
    : { success: "Password updated. You can now open your dashboard." };
}
