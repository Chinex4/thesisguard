import Link from "next/link";
export default function NotFound() {
  return (
    <main id="main" className="empty">
      <h1>Page not found</h1>
      <p>This page or document is unavailable.</p>
      <Link href="/dashboard" className="btn">
        Go to dashboard
      </Link>
    </main>
  );
}
