# Verification and acceptance

## Recorded local results — 8 September 2026

| Check | Result |
|---|---|
| ESLint | Passed, no warnings |
| Next route generation and TypeScript | Passed |
| Vitest | 75 tests passed across 6 files |
| Production build | Passed with Next.js 16.3.4 / Webpack |
| Production Chromium browser suite | 9 passed; 1 desktop skip for the mobile-only navigation test |
| Schema duplicate | Identical to the authoritative migration |
| Dependency installation | `npm ci` completed; npm reported 0 vulnerabilities at installation time |

The earlier development-server browser run encountered cold compilation delays. The recorded browser results above are from the successful production-server run. These results cover the local revision and environment, not a hosted deployment.

## Scope

Validation is performed on Node 24 using the locked dependencies. Automated tests do not require production credentials or call paid APIs. They verify the implementation locally; they do not establish that a particular hosted Supabase project, email provider or API account is configured correctly.

- **Algorithm tests:** token offsets and Unicode, normalization, n-grams, fingerprints, winnowing, exact/lexical overlap, reference exclusions, low-information text and deduplicated scores.
- **Document tests:** genuine PDF/DOCX parsing, corrupt/empty/oversized inputs, dishonest ZIP expansion metadata, filename sanitization and readable PDF report generation.
- **Provider tests:** request/response contracts, query budgets, missing credentials, malformed output, retries, AI evidence constraints and public-address validation, using mocked HTTP responses.
- **Database tests:** the actual SQL migration runs in PGlite with minimal Supabase Auth/Storage stubs. Tests exercise RLS, role escalation prevention, private report access, queue admission, limits and review transitions.
- **Workflow/API tests:** authorization, origin checks, staging ownership and independent provider failure handling. These use mocked application clients and complement the SQL tests.
- **Browser tests:** Chromium desktop and mobile layouts, public navigation, authentication configuration states, all major private route setup states and unauthenticated API denial. Run `npm run build` before `npm run test:e2e`; the suite starts a production server and expects no Supabase credentials.

## Visual inspection

The landing page, generated report PDF, desktop upload form and mobile report have been visually inspected. Report and upload fixtures fit both 390 px and 1,440 px viewports without horizontal document overflow. Report/upload fixtures render actual application components with explicitly synthetic data; they are development artifacts, never application records or evidence of a live scan. Files under `output/` are ignored by Git.

## Live acceptance checklist

Use a separate Supabase test project and disposable accounts. Complete this checklist before institutional deployment:

1. Apply the migration and seed. Confirm RLS is enabled and the `theses` bucket is private. Register two students; verify confirmation, sign-in, sign-out, password reset and profile updates.
2. Bootstrap an administrator with the trusted SQL editor. Promote a supervisor using the admin interface. Confirm public registration cannot select privileged roles.
3. Upload a genuine PDF and DOCX. Confirm progress, extracted word count, metadata validation and draft/submission transitions. Reject corrupt files and files above the configured limit.
4. Assign one submission to the supervisor. Confirm a different student and an unassigned supervisor cannot view its private files, scan or report, including direct API requests.
5. Submit and approve a synthetic source thesis. Confirm it appears in filtered/paginated repository results. Its private scan must remain inaccessible to unrelated users.
6. Upload a related document as the second student. Start the worker and a repository-only scan. Observe queued/running/completed progress, paired source passages, deduplicated score and PDF download. Same-student sources are intentionally excluded.
7. Enable Tavily (or Brave), OpenAlex and DeepSeek with test keys. Scan a short document with known public overlap. Inspect retrieved links, coverage labels and AI attribution. Confirm no source or percentage is invented by AI.
8. Disable or invalidate one provider at a time. Confirm repository results survive, coverage warnings are visible, and AI-only retry does not repeat the search or alter deterministic scores.
9. Request a revision, upload the permitted new version and inspect history. Approve it, then test admin archive, organization management and institutional settings.
10. Exercise daily scan limits and duplicate active-scan rejection. Interrupt the worker during a scan and verify lease recovery or a bounded terminal failure.
11. Confirm signed download links expire and staging cleanup removes only old abandoned uploads. Inspect application logs for accidental secrets or document text.
12. Repeat critical student/supervisor flows on a phone-size viewport with keyboard navigation. Test a realistic long thesis to measure extraction time, worker memory and hosting limits.

Live Auth/email/Storage and provider checks remain dependent on the institution's credentials and infrastructure. No hosted deployment or paid provider call is implied by local verification.
