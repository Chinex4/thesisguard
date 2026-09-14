import { Brand } from "@/components/ui";
import { ShieldCheck } from "lucide-react";
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth-layout">
      <aside className="auth-aside">
        <div>
          <Brand />
        </div>
        <div>
          <ShieldCheck size={40} className="mb-6 text-blue-200" />
          <h1>A stronger foundation for original research.</h1>
          <p>
            Preserve your ideas. Understand your sources.
            <br />
            Move your research forward with confidence.
          </p>
        </div>
        <small className="text-blue-200">
          Built for students, supervisors, and institutions.
        </small>
      </aside>
      <main id="main" className="auth-main">
        <div className="auth-box">{children}</div>
      </main>
    </div>
  );
}
