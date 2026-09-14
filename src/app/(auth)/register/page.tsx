import { AuthForm } from "@/components/auth-form";
import { configured } from "@/lib/config";
import { directories } from "@/lib/services/data";
export const dynamic = "force-dynamic";
export default async function Page() {
  const data = await directories();
  return (
    <>
      <h1>Begin your research journey</h1>
      <p className="mb-8">Create your student account to get started.</p>
      <AuthForm mode="register" configured={configured()} {...data} />
    </>
  );
}
