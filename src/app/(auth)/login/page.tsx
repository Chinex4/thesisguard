import { AuthForm } from "@/components/auth-form";
import { configured } from "@/lib/config";
export const dynamic = "force-dynamic";
export default async function Page() {
  const data = { faculties: [], departments: [] };
  return (
    <>
      <h1>Welcome back</h1>
      <p className="mb-8">Your research workspace is ready when you are.</p>
      <AuthForm mode="login" configured={configured()} {...data} />
    </>
  );
}
