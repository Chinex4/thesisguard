"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main id="main" className="empty">
      <h1>This page is temporarily unavailable</h1>
      <p>
        The service could not be reached. Please try again or contact your
        institution’s administrator.
      </p>
      <button className="btn" onClick={reset}>
        Try again
      </button>
    </main>
  );
}
