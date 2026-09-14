# ThesisGuard

**Design of an Online Student Thesis Repository with Automated Plagiarism Detection and Prevention**

A full-stack academic research repository for students, supervisors, and administrators, with deterministic textual similarity reports and optional AI citation guidance.

> A similarity score indicates textual overlap and should not by itself be treated as proof of plagiarism. Human academic review is recommended.

## What is included

- Supabase Auth registration, sign-in/out, email confirmation, password reset, profiles, and server-enforced roles.
- Private PDF uploads, metadata validation, draft submission, revised versions, supervisor assignment, review decisions and history.
- Searchable approved repository with author/title/keyword search, faculty/department/year filters, sorting and pagination.
- Node document extraction, indexed repository fingerprints, exact and lexical matching, deduplicated eligible-word scoring.
- Default Tavily adapter, optional Brave adapter, OpenAlex discovery and bounded safe retrieval of public HTML/open-access PDFs.
- Database-backed scan queue, progress polling, worker leases, daily limits, independent provider failure handling and AI-only retry.
- Evidence-based source cards, highlighted passage comparisons, quotation/citation/reference labels, filters and downloadable PDF reports.
- Administrator user roles, faculties/departments, thesis management and configurable institutional thresholds.
- Responsive Next.js/Tailwind interface with Material UI controls, mobile navigation and clear loading, empty, error and setup states.
- SQL migrations and RLS tests, synthetic demo generation, unit/integration tests, browser tests and project-defence documentation.

## Stack and architecture

Next.js 16 App Router, React 19, TypeScript, Tailwind 4, Material UI 9, React Hook Form, Zod, Supabase PostgreSQL/Auth/Storage, Mammoth, pdf-parse, pdf-lib, Vitest and Playwright. Application dependencies are pinned with an npm lockfile. Use Node 24 LTS.

Three tiers separate the presentation (`src/app`, `src/components`), business services and algorithms (`src/lib`), and data (`supabase`). The scan worker runs separately from the web process. See [architecture](docs/architecture.md) and [database design](docs/database.md).

## Quick start

From this folder:

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`. Without Supabase credentials, the public site runs and private pages explain the missing setup. No fictional accounts or results are substituted. Configure the database below to enable real workflows.

After configuring credentials, start a second terminal:

```bash
npm run worker
```

A queued scan will not advance without the worker. For a production server, run `npm run build`, then `npm start`, alongside the worker.

## Supabase setup

1. Create a new project in the [Supabase dashboard](https://supabase.com/dashboard).
2. Put its URL and public anon key in `.env.local`, plus the **server-only** service-role key. Never expose the service-role credential through a `NEXT_PUBLIC_` variable.
3. Run all SQL migration files in `supabase/migrations/` in filename order in the project's SQL editor. It creates the schema, triggers, indexes, RPCs, RLS policies, and private `theses` Storage bucket. Do not disable RLS or make the bucket public.
4. Run `supabase/seed.sql` for a starter faculty/department directory. Settings defaults are created by the migration.
5. In Auth URL Configuration set Site URL to `http://localhost:3000`; add `http://localhost:3000/auth/callback` to redirects. Add the deployed URL when deploying. If using `127.0.0.1`, add that origin explicitly.
6. Configure email confirmation and SMTP as appropriate. Register a student account through `/register`, confirm the email and sign in.
7. Bootstrap the first administrator in the trusted SQL editor using the real Auth UUID:

```sql
update public.profiles set role = 'ADMIN' where id = 'THE_REAL_AUTH_USER_UUID';
```

Use `/admin/users` for subsequent role assignments. Supervisor/Admin are never options on public registration.

The migration is authoritative. `scripts/schema.sql` is a readable duplicate kept for project-defence inspection; apply only the migration once. For the CLI workflow or a Docker-backed local Supabase instance, see [deployment](docs/deployment.md). Docker and Supabase credentials are not required to run the isolated PostgreSQL policy tests.

## Environment variables

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_APP_NAME` | Reserved application label; the current interface uses ThesisGuard |
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public project key; RLS enforces data access |
| `SUPABASE_SERVICE_ROLE_KEY` | Secret server/worker operations |
| `NEXT_PUBLIC_SITE_URL` | Canonical app origin for Auth callbacks |
| `DEEPSEEK_API_KEY` | Optional at startup; enables paid AI guidance |
| `DEEPSEEK_MODEL` | Defaults to `deepseek-v4-flash`; configure an available compatible model |
| `TAVILY_API_KEY` | Free-tier default public web provider key |
| `WEB_SEARCH_PROVIDER` | `tavily` by default, or `brave` |
| `BRAVE_SEARCH_API_KEY` | Needed only when Brave is selected |
| `OPENALEX_API_KEY` | Free OpenAlex key for the intended allowance |
| `MAX_UPLOAD_SIZE_MB` | Default 20; institution settings may lower it |
| `MAX_WEB_SEARCH_QUERIES_PER_SCAN` | Default/hard cap 15 |
| `MAX_ACADEMIC_SEARCH_QUERIES_PER_SCAN` | Default/hard cap 10 |
| `MAX_AI_ANALYSIS_MATCHES` | Default/hard cap 20 |

Obtain Tavily, OpenAlex, DeepSeek and optional Brave keys as described in [API setup](docs/api-setup.md). Missing providers produce coverage warnings; they do not require purchasing another service to run repository comparison. Automated tests never call paid APIs.

## Using the application

- **Student:** register → upload metadata/document → save draft or submit → open thesis → start similarity check → view progress → inspect/download report → upload a permitted revision.
- **Supervisor:** sign in after role assignment → open assigned submissions → inspect source evidence → comment and approve, request revision, or retain under review.
- **Administrator:** manage roles and organization → assign supervisors → manage theses and scans → configure thresholds, upload/daily limits and provider toggles.

Approved theses enter the authenticated repository. Approval does not publish their private similarity scans. Files use short-lived signed download URLs.

## Demo data

The seed contains no passwords or pretend Auth users. To create useful synthetic thesis drafts:

```bash
npm run demo -- REAL_STUDENT_PROFILE_UUID
```

Create the student through Supabase Auth first. The script generates three clearly labeled synthetic PDFs, parses and indexes them through the real thesis service. Submit and approve examples through the actual staff workflow. Use another test student for comparison because same-student versions are excluded from repository candidate search. Do not use real personal research as a public demo fixture.

## Tests and production build

```bash
npm run lint
npm run typecheck
npm test
npm run build
# Or all four:
npm run verify

# Build first, then install Chromium and run public/setup-state tests:
npx playwright install chromium
npm run test:e2e
```

The Playwright public suite expects the app to run without configured Supabase credentials. Stop an existing configured server before running it, or use an isolated checkout/environment. Unit tests mock provider requests; database tests use PGlite with small Auth/Storage stubs to execute the real migration and RLS policies. PDF/DOCX tests parse real generated documents. See [verification and acceptance checks](docs/verification.md) for test scope and remaining live-service checks.

## Similarity algorithm

The primary percentage is `matched eligible submitted words / eligible submitted words × 100`. Overlapping spans are merged before counting, including overlap across source categories. Five-word n-grams, FNV-1a hashes, winnowing, bigram Jaccard and term-frequency cosine identify and verify meaningful candidates. Reference sections are excluded by default. AI supplies explanations only; it cannot calculate the score or create sources. [The algorithm guide](docs/plagiarism-engine.md) explains formulas, examples, complexity tradeoffs and limitations for project defence.

## Deployment and maintenance

[Deployment instructions](docs/deployment.md) cover Vercel, persistent worker hosting, self-hosting, Supabase setup and production checks. The browser uses direct signed Storage uploads for the 20 MB path. Run the Node worker on an institutional machine or persistent server; deploying the web app to Vercel alone does not run background scans.

```bash
npm run cleanup:staging
```

This removes abandoned staging uploads and unreferenced finalization copies older than 24 hours. Finalized documents are never targeted. Back up the database, define retention policies, and monitor worker health and provider quotas before institutional rollout.

## Directory map

```text
thesisguard/
├── src/
│   ├── app/                 # Public/auth/workspace routes, APIs, callback
│   ├── components/          # Layout, upload, scan, report, staff forms
│   ├── lib/
│   │   ├── auth/            # Verified identity, roles, Auth actions
│   │   ├── supabase/        # Browser, SSR and server-only privileged clients
│   │   ├── services/        # Uploads, thesis workflows, repository, scans
│   │   ├── documents/       # PDF/DOCX extraction and preprocessing
│   │   ├── plagiarism/      # Deterministic algorithms and candidate search
│   │   ├── search/          # Query selection, Tavily/Brave/OpenAlex
│   │   ├── ai/              # Structured DeepSeek guidance
│   │   ├── security/        # SSRF protection
│   │   ├── reports/         # PDF generation
│   │   └── validations/     # Zod request schemas
│   └── types/
├── supabase/migrations/     # Schema, RLS, bucket, queue RPCs
├── supabase/seed.sql
├── scripts/                 # Worker, demo and maintenance commands
├── tests/                   # Algorithms, providers, policies, APIs, E2E
├── docs/                    # Architecture, defence, setup and verification
├── .env.example
└── package.json
```

## Known limitations

This is a defensible educational implementation, not a substitute for an institution's academic review process. It cannot access every private database or paywalled publication, reproduce Turnitin's proprietary student-paper collection, or detect every sophisticated paraphrase. OCR, cross-language detection and semantic embeddings are not implemented. Search snippets and abstracts offer partial coverage; report labels disclose this. Same-student work is excluded from repository comparison. Reference, quotation and citation detection are heuristic. Lexical coverage is approximate.

Search budgets and candidate caps trade recall for predictable development cost. Reports can legitimately show zero because sources were unavailable, not because originality was proven. Third-party models, search indexes, pricing and free allowances can change. PDF reports use built-in Latin fonts and transliteration for unsupported characters. Large institutional deployments need paginated administrative analytics, stronger distributed worker fencing, monitoring, retention automation and workload benchmarking. Real hosted Auth/email/Storage/provider flows must be smoke-tested with your credentials before deployment.
