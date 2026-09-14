# PDF upload investigation and page refactor

## Findings and limits of the diagnosis

The previous browser flow selected a local file in step 2 and advanced to review without uploading it. Only Save draft/Submit thesis started a single `XMLHttpRequest` PUT to a signed Storage URL. `xhr.onerror` discarded the underlying browser failure and always displayed “Network connection lost during upload.” There was no resume support, request deadline, cancellation handler or useful HTTP error classification.

The code already awaited Storage before calling `/api/theses`; it did not intentionally create a thesis record after a rejected PUT. However, retrying the overall workflow requested a new random staging path and generated a new thesis ID. A lost finalization response could therefore create a duplicate on retry. Finalization also deleted staging in `finally`, making a failed database save require another upload.

A 7.77 MB file is below the default 20 MB application limit. The file went directly to Storage, so Next.js Server Action/body limits did not govern that failed PUT. The browser did not import the service-role client. The bucket name and owned staging path were consistent, signed authorization was generated server-side, and the step transition did not explicitly abort an XHR.

**The precise cause of the reported zero-response network failure is not proven by the supplied evidence.** “Provisional headers” is not a CORS diagnosis. This checkout has no `.env.local`; its cloud-only `.env` could not be read (macOS returned “Operation canceled”). The original PDF and exact Chrome `net::ERR_*` code were not supplied. Local mock tests cannot establish whether the original connection was blocked by a browser extension, proxy, DNS/TLS failure, CORS policy or service outage.

The implemented fix addresses the confirmed transfer/retry weaknesses. Supabase recommends resumable uploads for files above 6 MB and supports signed tokens for this protocol: [standard upload guidance](https://supabase.com/docs/guides/storage/uploads/standard-uploads), [resumable and presigned uploads](https://supabase.com/docs/guides/storage/uploads/resumable-uploads). The 6 MB recommendation is not a hard standard-upload size limit.

## Upload changes

1. Validate metadata and the selected PDF's extension, header and institution size limit. The server still parses and validates the actual document before saving.
2. Issue an owned, non-upserting signed staging authorization through the authenticated API.
3. Upload through TUS using 6 MB chunks, bounded transient retries and progress. Hosted projects use their direct Storage hostname; local/custom project origins are preserved.
4. Move to review only after the transfer reports success. Byte transfer reaching 100% alone does not count as success.
5. Save DRAFT or SUBMITTED metadata only after downloading and parsing the confirmed stored file. Preserve revised-version metadata and existing role checks.
6. Use the staging UUID as the final thesis ID. Commit the thesis and all chunks atomically. Return the same ID when a finalization response is lost and retried; the first committed status wins.
7. Remove staging after success or when the student replaces the selected file. Preserve failed-finalization bytes for retry. `npm run cleanup:staging` removes abandoned staging and old unreferenced finalization files after 24 hours; referenced thesis documents are retained. Interrupted TUS sessions expire according to Storage's retention.

Errors distinguish connection failure, session expiry, oversized/invalid PDF, storage permission, unavailable bucket, expired authorization, cancellation, timeout, conflict and API/server failure. Development logs contain only stage, category and HTTP status. Raw errors, signed URLs, tokens and file contents are never logged by the application.

New thesis uploads now accept PDF only, as requested. Existing DOCX extraction/report/repository code remains available for legacy documents; the page refactor itself changes no content or behavior.

## Required database update

For an existing initialized project, apply **only** the new migration:

[`20260912205129_atomic_thesis_upload.sql`](../supabase/migrations/20260912205129_atomic_thesis_upload.sql)

Run its contents in your trusted Supabase SQL editor before using the updated finalization flow. For a fresh project, apply both migration files in filename order, then the seed. Do not rerun the initial schema against an initialized database.

The function is executable only by `service_role`. It does not relax RLS or grant public Storage writes. This migration was tested locally with PGlite; it has not been applied to your hosted project from this checkout.

## Page refactor

Removed: `src/components/workspace-pages.tsx`.

Created:

```text
src/components/pages/
├── dashboard/dashboard-page.tsx
├── repository/repository-page.tsx
├── theses/thesis-list-page.tsx
├── theses/thesis-detail-page.tsx
├── theses/new-thesis-page.tsx
├── scans/scan-start-page.tsx
├── scans/scan-list-page.tsx
├── scans/scan-detail-page.tsx
├── profile/profile-page.tsx
├── admin/admin-settings-page.tsx
├── admin/admin-users-page.tsx
└── admin/admin-departments-page.tsx
```

Each function was moved intact with its own imports. The catch-all route imports the files directly; no barrel or circular dependency was added. Async Server Components, authorization, queries, content, routes and reusable client components are preserved.

## Files changed for uploads

- `src/components/thesis/upload-form.tsx`: step gating, PDF selection, progress, cancellation and retry state.
- `src/lib/uploads/client.ts` (new): resumable transport and bounded API calls.
- `src/lib/uploads/errors.ts` (new): safe error classification and diagnostics.
- `src/lib/services/uploads.ts`: signed TUS admission, owned cleanup and idempotent finalization.
- `src/lib/services/theses.ts`: PDF-only admission and atomic thesis/chunk persistence.
- `src/app/api/[...path]/route.ts`: authenticated cleanup endpoint and structured upload error codes.
- `supabase/migrations/20260912205129_atomic_thesis_upload.sql` (new): atomic finalization RPC.
- `scripts/cleanup-staging.ts`: cleanup of old unreferenced finalization objects.
- `package.json`, `package-lock.json`: pinned `tus-js-client` dependency.
- `tests/uploads.test.ts`, `tests/uploads-service.test.ts` (new): transport and finalization regressions.
- `tests/database.test.ts`: run all migrations and verify atomicity, idempotency and RPC permissions.

The route consumer and `docs/architecture.md` were updated for the page move. Setup documentation points to the new migration.

## Manual testing in Chrome DevTools

Start `npm run dev` after configuring `.env.local` and applying the new migration. Sign in as a test student and open `/theses/new`.

1. Open DevTools → Network. Enable Preserve log. Keep Console open too. Use your own PDFs, not real sensitive research for a public demonstration.
2. Fill metadata and continue. Select a PDF. The file should say “Selected — not uploaded.” No thesis record should exist yet.
3. Press Continue. Expect `POST /api/uploads` to return 200, then Storage TUS `POST`/`PATCH` requests. A resumed attempt can include `HEAD`. Inspect statuses and the `Upload-Offset` response header; successful creation is normally 201 and successful chunk writes 204.
4. Confirm progress and that review only appears after Storage succeeds. Do not copy/share the `x-signature` header, signed URL, cookies or credentials.
5. On review, choose Save draft or Submit thesis. Expect `POST /api/theses` with a small JSON body, then 201 and navigation to the thesis detail. Check the persisted status and one thesis record for the upload ID.
6. For any failure, record only the stage, HTTP status and exact `net::ERR_*` Console text. An OPTIONS/preflight failure with an explicit CORS message is meaningful evidence; provisional headers alone are not.

| Case | Expected result |
|---|---|
| Small text PDF | Completes upload, review and save; reportable text is extracted |
| Your 7.77 MB PDF | Multiple resumable chunks; review waits for confirmation |
| PDF just below configured maximum | Accepted and completed within actual bucket/host limits |
| PDF above configured maximum | Rejected before Storage transfer; server independently enforces limit |
| Renamed non-PDF, empty, corrupt or encrypted PDF | Header/type or server parser rejection; no saved thesis |
| Network set Offline during transfer | No review or thesis save; restore Online and retry Continue using the retained attempt |
| Cancel during transfer | Clear cancellation error; metadata remains; retry resumes the attempt |
| Finalization response blocked/lost | Retry Save returns the same thesis ID without another Storage transfer or duplicate record |
| Save draft | One DRAFT thesis |
| Submit thesis | One SUBMITTED thesis |
| Revised upload from an eligible draft/rejected thesis | Correct `version_of`; existing resubmission checks remain enforced |
| Session expires before finalization | Sign-in/session error; no false success |
| Storage permission/bucket/token failure | Specific safe category when Storage supplies an HTTP response |

After a network failure, retry in the same page to retain the in-memory TUS attempt. Reloading starts a fresh client attempt; the abandoned-object cleanup remains necessary. Do not run maintenance while deliberately testing a more-than-24-hour-old pending upload.

## Verification results

- All 12 moved page functions were compared as TypeScript syntax trees against their pre-refactor originals: identical.
- Chromium with the real UploadForm and TUS client, mocked HTTP services: synthetic 7.77 MB upload passed for both DRAFT and SUBMITTED, including a simulated connection reset/resume, review gating, exactly one finalization request and preserved revision metadata. No browser page errors.
- This browser test uses synthetic PDF-shaped bytes to test transport; genuine PDF parsing is covered separately by document tests. It is not a hosted Storage acceptance test.
- ESLint: passed.
- TypeScript: passed.
- Vitest: 100 tests passed across 8 files, including real PostgreSQL migration/RLS/atomic-finalization tests.
- Validation ran in a temporary copy inside `output/`, using the same source and locked dependencies, without environment files. The original workspace had cloud-only dependency files and an unreadable `.env`; dependencies were restored using `npm ci --prefer-offline`. No credentials or environment-file contents were changed.
- Production build: passed (Next.js 16.3.4 / Webpack). The temporary nested copy caused an expected multiple-lockfile workspace-root warning.
- Production Chromium suite: 9 passed, 1 intentional skip (the mobile-only navigation case on desktop).
- No remaining imports of the removed combined page file were found in the validated source/tests.

These results are from September 13, 2026. They do not confirm the behavior of your hosted Supabase project or the original failing PDF. Apply the new migration and follow the Chrome matrix above with your actual file.
