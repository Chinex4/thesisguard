import { AuthForm } from "@/components/auth-form";
import { configured } from "@/lib/config";
export const dynamic = "force-dynamic";
export default async function Page() {
  const data = { faculties: [], departments: [] };
  return (
    <>
      <h1>Choose a new password</h1>
      <p className="mb-8">Use a strong password you haven’t used elsewhere.</p>
      <AuthForm mode="reset-password" configured={configured()} {...data} />
    </>
  );
}
