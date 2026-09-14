# Running and deploying ThesisGuard

## Local development

Use Node 24 LTS and npm. Run `npm ci`, copy `.env.example` to `.env.local`, configure Supabase, and apply the SQL migration. Start the UI with `npm run dev`. Start `npm run worker` in another terminal after configuring server credentials. The worker is required for queued scans to progress.

The public landing and authentication pages compile without secrets; account actions are disabled and authenticated paths show a setup state. This is not a bypass into fake student records. Supabase-dependent end-to-end checks need a configured test project.

## Database setup

In a new Supabase project, run all files in `supabase/migrations/` in filename order in the SQL editor, followed by `supabase/seed.sql`. The migration creates the private `theses` bucket with a 20 MB limit and PDF/DOCX MIME allowlist. Do not enable public bucket access.

Alternatively, use the bundled CLI: inspect `npx supabase link --help` and `npx supabase db push --help`, link the intended project, and push migrations. For local Supabase, install Docker, inspect `npx supabase init --help` and `npx supabase start --help`, initialize and start the stack, then apply migrations. Do not reset a database containing real records merely to apply this project's schema.

Register the first account through the app or Auth dashboard. Then, in the trusted SQL editor, assign the initial administrator:

```sql
update public.profiles
set role = 'ADMIN'
where id = 'THE_REAL_AUTH_USER_UUID';
```

This is the only bootstrap promotion. Thereafter use `/admin/users`. Public registration never exposes a role selector. Create a supervisor account and have an administrator promote it. Assign a thesis supervisor in `/theses/[id]` as administrator, or during student upload.

## Vercel UI/API

1. Import the repository and set the root directory to `thesisguard` if it is nested in a larger repository; use `.` if this folder itself is the repository root.
2. Use Node 24, install command `npm ci`, and build command `npm run build`.
3. Add environment variables from `.env.example` for the intended environment. Add the exact deployment URL to Supabase Auth redirects and set `NEXT_PUBLIC_SITE_URL`.
4. Deploy the Next.js UI/API. Verify sign-in, private file download and a real test upload.
5. Run the separate worker below. Vercel's request runtime does not run `npm run worker` persistently.

The browser uploads directly to a signed Supabase Storage URL, avoiding a 20 MB request body through a Vercel Function. Finalization downloads/parses the object server-side; the API maximum duration is configured at 300 seconds, subject to your hosting plan's actual limits. Large or complex PDFs can still exceed CPU/memory limits. Prefer a persistent server for particularly heavy document workloads. The self-hosted multipart compatibility endpoint is not the recommended upload path on Vercel.

## Worker hosting

Run `npm ci` (including `tsx`) and `npm run worker` on a persistent Node host or institutional machine. Supply the same database and provider environment variables. A local workstation is sufficient for development and project defence, with no additional paid service. For production, keep it supervised using systemd, Docker, or a process manager and arrange automatic restarts. Do not promise continuous processing while the workstation sleeps or is offline.

Database leasing supports concurrent workers, heartbeat recovery and bounded retries. Keep system clocks synchronized. For large-scale production, add stronger lease fencing, metrics and alerting before expanding worker concurrency.

## Self-hosted web service

Run `npm run build`, then `npm start` behind an HTTPS reverse proxy, alongside the worker. Limit inbound request sizes and connection rates at the proxy. Keep keys outside source control. Configure storage retention, backups, institution privacy policies and operational monitoring.

## Maintenance

Run `npm run cleanup:staging` to remove abandoned staging objects older than 24 hours. This targets abandoned staging files and old finalization copies that have no thesis database reference. Referenced thesis documents are retained. The development script processes up to 1,000 folders per user per pass; large installations should use a paginated scheduled maintenance job.

Review failed scan messages, missing provider warnings and API quota dashboards. A scan remaining QUEUED usually means the worker is not running or cannot reach the database. An unavailable-guidance report can retry DeepSeek without repeating source search. A failed worker is retried through the database lease logic; terminal failed scans can be resubmitted within the daily limit.

## Release checks

`npm run verify` runs lint, TypeScript, unit/integration tests and the production build. `npm run test:e2e` tests the unconfigured public experience with Playwright. Apply the migration to a staging Supabase project and run the real user acceptance checklist in `docs/verification.md` before exposing the app to students.
