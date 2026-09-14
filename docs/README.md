# ThesisGuard: what to do next

Start here to move from the implemented application to a working project with your own accounts and documents. Run terminal commands from the `thesisguard` folder.

For the September 12 upload update, follow [the migration and Chrome test guide](upload-fix-and-page-refactor.md). Existing databases need the new atomic-finalization migration before uploads can be saved.

## 1. Prepare your local environment

Use Node.js 24, as required by this project's `package.json`.

```bash
cd /Users/chinex/Desktop/james-project/thesisguard
node --version
npm ci
```

Create your local configuration **only if `.env.local` does not already exist**:

```bash
cp -n .env.example .env.local
```

Edit `.env.local` in your editor. Do not put credentials directly in `src/lib/ai/deepseek.ts` or other source files. `.env.local` is excluded from Git.

## 2. Set up the database

Use a new Supabase project for your development work. In its SQL editor, run these files in order:

1. [Initial migration](../supabase/migrations/20260908103517_initial_thesisguard_schema.sql)
2. [Atomic upload finalization migration](../supabase/migrations/20260912205129_atomic_thesis_upload.sql)
3. [Faculty and department seed](../supabase/seed.sql)

The migration creates the tables, role protections, scan queue functions and private `theses` Storage bucket. The seed supplies a starting organization directory.

**Apply the migration once.** `scripts/schema.sql` is a duplicate for inspection; do not execute it as a second migration. If your database is already initialized, continue to configuration instead of resetting it.

Keep row-level security enabled and the Storage bucket private.

## 3. Configure `.env.local`

Fill in the database values first:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Use your project's public anon key for `NEXT_PUBLIC_SUPABASE_ANON_KEY` and its server-only service-role key for `SUPABASE_SERVICE_ROLE_KEY`. Never place the service-role key in a `NEXT_PUBLIC_` variable or share it in screenshots.

External integrations can be configured after the repository-only workflow works:

| Variable | What to supply |
|---|---|
| `TAVILY_API_KEY` | Your Tavily API key for the default public web search adapter |
| `WEB_SEARCH_PROVIDER` | Keep `tavily`, or use `brave` if configuring Brave instead |
| `BRAVE_SEARCH_API_KEY` | Required only when selecting Brave |
| `OPENALEX_API_KEY` | Your OpenAlex API key for academic discovery |
| `DEEPSEEK_API_KEY` | Your DeepSeek API key for optional match explanations |
| `DEEPSEEK_MODEL` | A compatible model available to your account; the template contains the configured default |

Keep the upload and query limits in [.env.example](../.env.example) initially. See [API setup](api-setup.md) for provider details. Repository comparison works without external provider keys; missing services are reported as coverage limitations. Actual provider requests can consume your account's quota or credits.

Restart the application and worker whenever you change environment variables.

## 4. Configure authentication

In your Supabase project's Auth URL configuration:

- Set the local Site URL to `http://localhost:3000`.
- Allow `http://localhost:3000/auth/callback` as a redirect URL.
- Configure confirmation/reset email delivery for your test accounts.

Use `localhost` consistently. If you choose `127.0.0.1` instead, update the site URL and allowed callback to match.

## 5. Start the application and worker

In the first terminal:

```bash
npm run dev
```

Open `http://localhost:3000`. If another ThesisGuard process already uses port 3000, stop that process with Ctrl+C in its terminal before starting this one.

In a second terminal, from the same project folder:

```bash
npm run worker
```

The worker should print `ThesisGuard scan worker ready`. Keep both terminals running. The web application creates scan jobs; the worker performs them. A scan cannot advance while the worker is stopped.

If the page says **Connect your institution**, check the public Supabase variables and restart the app.

## 6. Create test accounts and roles

Register and confirm four disposable accounts through the application:

- Student A: creates the repository source document.
- Student B: uploads a document to compare against that source.
- Supervisor: reviews assigned submissions.
- Administrator: manages users, organization and settings.

New registrations receive the STUDENT role. To bootstrap your first administrator, obtain that account's real Auth user UUID and run this in the trusted Supabase SQL editor:

```sql
update public.profiles
set role = 'ADMIN'
where id = 'REPLACE_WITH_YOUR_REAL_AUTH_USER_UUID';
```

Sign in as that administrator, open `/admin/users`, and promote the supervisor account. Check `/admin/departments` and adjust the seeded faculty/department directory to match your institution. Use `/admin/settings` to review scan limits and provider settings.

## 7. Complete one repository-only scan

1. As Student A, upload a text-based PDF with accurate metadata and assign your test supervisor. Submit it for review.
2. As the assigned supervisor, review and approve it. Confirm it appears in `/repository`.
3. As Student B, upload a different test document containing some deliberately shared passages from the approved source.
4. Open the thesis and start a similarity check. Keep the worker running.
5. Follow the scan through queued/running/completed states.
6. Inspect the source cards, paired passages, coverage warnings and score. Download the PDF report.
7. Confirm Student B cannot open Student A's private scan or report.

Use two students because this implementation excludes the same student's work from repository candidates. Do not expect a document to match itself.

Optional: after Student A has a real profile, create synthetic draft documents with:

```bash
npm run demo -- REAL_STUDENT_PROFILE_UUID
```

These are drafts, not pre-approved sources. Submit and approve them through the application before using them for repository comparison.

## 8. Enable external discovery and AI guidance

After the repository-only scan succeeds, add your provider keys, restart both processes, and review provider toggles in `/admin/settings`.

Run a small test using known public material. Inspect the original links and coverage labels. Test missing or invalid provider credentials too: existing repository results should remain available with warnings. If AI guidance is unavailable, use its retry action after correcting the configuration.

DeepSeek explains detected matches; it does not determine the similarity percentage. Search snippets and abstracts are partial evidence, and a zero score does not prove originality.

## 9. Verify before your demonstration

Run:

```bash
npm run verify
```

This runs lint, TypeScript, automated tests and a production build. The September 13 upload/refactor validation recorded 100 passing automated tests and a successful production build in an isolated copy without environment files; rerun these checks after your changes.

For the public browser suite:

```bash
npx playwright install chromium
npm run build
npm run test:e2e
```

**Run that browser suite in an isolated environment without Supabase credentials and without an existing configured server.** It intentionally tests missing-configuration states. Use the [live acceptance checklist](verification.md) for your configured application's student, supervisor and administrator flows.

Before your project defence, prepare:

- Two student accounts and one supervisor/admin account.
- An approved source and a separate student submission with known overlap.
- A completed report and its downloaded PDF.
- A revision/review example and a provider-unavailable example.
- An explanation of the score formula, RLS, worker and algorithm limitations.

## 10. Deploy after live checks pass

Follow [deployment instructions](deployment.md). Configure the deployed site URL and Auth callback, provide environment variables on the host, and run the worker on a persistent Node host. Deploying the web application alone does not run background scans.

Hosted Auth, email, Storage and provider behavior must be checked using your accounts. Local tests do not establish that those services are configured correctly.

## Troubleshooting

| Symptom | First check |
|---|---|
| Setup page or disabled sign-in | Public Supabase values in `.env.local`; restart the app |
| Worker reports incomplete configuration | Supabase URL and server-only service-role key |
| Worker reports database connection unavailable | Project availability and whether the complete migration was applied |
| Scan stays QUEUED | Worker terminal is running and connected |
| No repository sources | Source is approved, belongs to another student and contains meaningful shared text |
| Web/academic coverage warning | Selected provider, key, quota and institution settings |
| AI guidance unavailable | DeepSeek key, available model and account balance/quota |
| Upload rejected | Genuine text-based PDF, configured size limit and valid metadata |
| Confirmation/reset link fails | Matching site origin, callback allowlist and email delivery |

## Documentation map

- [Main project README](../README.md): features, commands and environment reference.
- [Architecture](architecture.md): application tiers and processing flow.
- [Database](database.md): schema and access controls.
- [Similarity engine](plagiarism-engine.md): formulas, matching and limitations.
- [API setup](api-setup.md): search and AI configuration.
- [Verification](verification.md): recorded checks and live acceptance checklist.
- [Deployment](deployment.md): hosting, worker and maintenance.

**Your immediate next step:** create/configure the Supabase project, apply the migration and seed, then fill in `.env.local` before starting the application and worker.
