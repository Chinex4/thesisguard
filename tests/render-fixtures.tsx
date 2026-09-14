/** Standalone visual fixtures. Never loaded by the application or treated as scan evidence. */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { Providers } from "../src/components/providers";
import { ReportView } from "../src/components/report/report-view";
import { UploadForm } from "../src/components/thesis/upload-form";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { ServerInsertedHTMLContext } from "next/dist/shared/lib/server-inserted-html.shared-runtime";
import type { Scan } from "../src/types";
const router = {
  bfcacheId: "visual-fixture",
  back() {},
  forward() {},
  refresh() {},
  hmrRefresh() {},
  push() {},
  replace() {},
  prefetch() {},
};
const scan = {
  id: "visual-test",
  thesis_id: "test-thesis",
  status: "COMPLETED",
  overall_similarity: 24,
  repository_similarity: 24,
  web_similarity: 0,
  academic_similarity: 0,
  total_sources: 1,
  total_matches: 1,
  eligible_word_count: 100,
  matched_word_count: 24,
  ai_status: "AVAILABLE",
  warnings: [
    "Synthetic visual test fixture. These are not results from a real student scan.",
  ],
  created_at: "2026-09-08T12:00:00Z",
  completed_at: "2026-09-08T12:00:00Z",
  error_message: null,
  thesis: {
    title: "Environmental Monitoring with Distributed Sensor Networks",
    student: { full_name: "Test Student" },
    department: { name: "Computer Science" },
  },
} as Scan;
const sources = [
  {
    id: "source-one",
    source_type: "REPOSITORY",
    source_title: "Synthetic repository test document",
    source_url: null,
    author: "Test Author",
    publication_year: 2025,
    doi: null,
    similarity_score: 24,
    metadata: { coverage: "Synthetic test evidence" },
  },
];
const matches = [
  {
    id: "match-one",
    source_id: "source-one",
    submitted_text:
      "Distributed sensor networks monitor environmental conditions through coordinated measurements across geographically separated research stations.",
    source_text:
      "Distributed sensor networks monitor environmental conditions through coordinated measurements across geographically separated research stations.",
    similarity_score: 100,
    match_type: "EXACT",
    is_quoted: false,
    is_cited: true,
    excluded_from_score: false,
    in_references: false,
    ai_classification: "uncertain/requires human review",
    ai_explanation: "Synthetic guidance for visual verification only.",
    recommendation:
      "Verify the source and use accurate attribution for borrowed wording.",
    citation_concern: null,
  },
];
const css = readdirSync(".next/static/css")
  .filter((file) => file.endsWith(".css"))
  .map((file) => readFileSync(".next/static/css/" + file, "utf8"))
  .join("\n");
mkdirSync("output/visual", { recursive: true });
for (const [name, content] of [
  [
    "report",
    <ReportView key="report" scan={scan} sources={sources} matches={matches} />,
  ],
  [
    "upload",
    <UploadForm
      key="upload"
      faculties={[{ id: "faculty", name: "Science" }]}
      departments={[]}
      supervisors={[]}
    />,
  ],
] as const) {
  const styles: Array<() => React.ReactNode> = [];
  const html = renderToStaticMarkup(
    <ServerInsertedHTMLContext.Provider
      value={(callback) => styles.push(callback)}
    >
      <Providers>
        <AppRouterContext.Provider value={router}>
          <main
            id="main"
            style={{ maxWidth: 1180, margin: "auto", padding: 24 }}
          >
            {content}
          </main>
        </AppRouterContext.Provider>
      </Providers>
    </ServerInsertedHTMLContext.Provider>,
  );
  writeFileSync(
    "output/visual/" + name + ".html",
    '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ThesisGuard visual test fixture</title><style>' +
      css +
      "</style>" +
      renderToStaticMarkup(
        <>
          {styles.map((flush, index) => (
            <React.Fragment key={index}>{flush()}</React.Fragment>
          ))}
        </>,
      ) +
      "</head><body>" +
      html +
      "</body></html>",
  );
}
console.log(
  "Created report and upload visual fixtures from application components.",
);
