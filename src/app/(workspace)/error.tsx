"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div id="main" className="panel empty">
      <h2>This page could not be loaded</h2>
      <p>
        The service may be temporarily unavailable. Check the database
        configuration or try again.
      </p>
      <button className="btn" onClick={reset}>
        Try again
      </button>
    </div>
  );
}
