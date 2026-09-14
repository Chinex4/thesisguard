import { AuthForm } from "@/components/auth-form";
import { configured } from "@/lib/config";
export const dynamic = "force-dynamic";
export default async function Page() {
  const data = { faculties: [], departments: [] };
  return (
    <>
      <h1>Reset your password</h1>
      <p className="mb-8">We’ll email you a link to choose a new password.</p>
      <AuthForm mode="forgot-password" configured={configured()} {...data} />
    </>
  );
}
