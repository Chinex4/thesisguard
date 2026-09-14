# Database and access model

The authoritative migration is `supabase/migrations/*_initial_thesisguard_schema.sql`. It creates all tables, types, indexes, functions, RLS policies and the private `theses` bucket. Apply it before creating accounts so the profile trigger exists.

| Table | Purpose and relationships |
|---|---|
| `profiles` | One-to-one with `auth.users`; student/staff fields, faculty, department, and database-controlled role. Auth manages passwords. |
| `faculties` | Top-level institutional organization. |
| `departments` | Belongs to a faculty. |
| `theses` | Belongs to a student and optionally an assigned supervisor; points to faculty, department, private file, and previous version. Stores original extracted text and normalized text. |
| `thesis_chunks` | Many per thesis, unique chunk index, normalized/original text, word count, and bigint fingerprint array with GIN index. |
| `plagiarism_scans` | Many per thesis; requester, pipeline status, score breakdown, counts, warnings, AI status and worker lease fields. |
| `scan_sources` | Candidate-source metadata, type, real URL/DOI, coverage and verification notes; linked to one scan. |
| `similarity_matches` | Passage evidence associated with both a scan and a source; word/character bounds, exclusions, citation flags and optional AI guidance. |
| `supervisor_reviews` | Append-only review history with thesis, reviewer, decision, comment and timestamp. |
| `system_settings` | Single validated institutional configuration row. |

## Statuses and transitions

Theses begin DRAFT or SUBMITTED. Only a draft owner can submit. Assigned supervisors and administrators can move SUBMITTED/UNDER_REVIEW work to UNDER_REVIEW, APPROVED or REJECTED. Approval records a timestamp and publishes the document to the authenticated repository. An administrator may archive it. Only drafts and archived entries may be permanently deleted. A version referenced by another thesis cannot be deleted without first resolving the relationship. A student can upload a revised version of their draft or rejected work only when institution settings allow it.

Scans move QUEUED → EXTRACTING → SEARCHING_REPOSITORY → SEARCHING_WEB → SEARCHING_ACADEMIC → COMPARING → AI_ANALYSIS → COMPLETED, or FAILED. The worker may skip a disabled provider while retaining its progress stage and a coverage warning. A unique partial index rejects a second active job for a thesis.

## Access matrix

| Resource | Student | Supervisor | Administrator |
|---|---|---|---|
| Approved theses/files | Read | Read | Read/manage |
| Private thesis/files | Own only | Assigned only | All |
| Scan/source/match evidence | Own thesis only | Assigned thesis only | All |
| Upload and submit | Own work | No public student upload | Manage existing theses |
| Reviews | Read own work | Write assigned work | Write all |
| Profile edits | Own basic fields | Own basic fields | Role assignment via server |
| Faculty/department directory | Read | Read | Manage |
| Institution settings | Read | Read | Manage |

Every public application table has RLS enabled. General repository access never grants private scan access. Basic directory tables are readable anonymously for registration. Profile reads allow relevant approved authors and supervisors; passwords are never stored here.

Workflow mutations use server services with explicit authorization and the service-role credential. Authenticated Data API clients have SELECT and a narrow column-level UPDATE grant for their own basic profile fields, not arbitrary thesis/role/score writes. RLS is not disabled. Service-role credentials must stay on trusted servers.

## Privileged functions

`private.current_role` and `private.can_read_thesis` are fixed-search-path security-definer helpers to avoid recursive RLS evaluation. They require an authenticated identity and are not exposed in the public Data API schema. The Auth trigger always creates STUDENT, ignoring any user-provided role.

`enqueue_scan`, `claim_scan`, `repository_candidates`, and `review_thesis` are service-role-only public RPCs. Enqueue and review independently enforce the passed user's database role/assignment. Public execute privileges are explicitly revoked. Worker claiming and quota admission are transactional.

## Verification

`tests/database.test.ts` runs the actual migration on PGlite's PostgreSQL engine, with small test-only Auth/Storage schema stubs. It checks RLS isolation, role escalation, private storage metadata, quotas, and review transactions. This validates SQL and application policies, but does not replace a deployment smoke test against Supabase's actual Auth, Storage, and PostgREST services.

Optional `seed.sql` creates faculties and departments without passwords. Use `npm run demo -- STUDENT_UUID` after creating a real test student to upload clearly labeled synthetic demonstration documents. Do not run demo generation against real institutional records without intending to add those entries.
