import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { configured } from "@/lib/config";
import { serverDb } from "@/lib/supabase/server";
import type { Profile, Role } from "@/types";
export const session = cache(async (): Promise<Profile | null> => {
  if (!configured()) return null;
  const db = await serverDb();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return null;
  const { data, error } = await db
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();
  if (error)
    throw new Error(
      "Your profile could not be loaded. Check database setup or contact your administrator.",
    );
  return data as Profile;
});
export async function requirePage(roles?: Role[]) {
  const user = await session();
  if (!user) redirect("/login");
  if (roles && !roles.includes(user.role)) redirect("/dashboard");
  return user;
}
export async function requireApi(roles?: Role[]) {
  const user = await session();
  if (!user) throw new HttpError(401, "Please sign in to continue.");
  if (roles && !roles.includes(user.role))
    throw new HttpError(403, "You do not have permission for this action.");
  return user;
}
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
