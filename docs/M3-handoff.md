# M3 backend delivery and integration handoff

Date: 20 October 2026. Baseline approval: user confirmed team approval in chat;
see decisions/0001-m3-baseline.md. This is an implementation report, not a claim
of frontend integration, deployment, review or merge.

## Implemented

- Four immutable numbered SQL migrations: users/PostgreSQL sessions, properties
  and indexes, property images, and durable account-status audit.
- Transactional/checksummed migration runner with concurrent-run lock, safe
  reruns, missing/changed-file detection and rollback.
- Registration, login, logout and `/auth/me`: normalized unique email, bcrypt,
  strict public roles/fields, session rotation, HttpOnly/SameSite cookies,
  production Secure cookies, origin-based CSRF and authentication rate limits.
- Shared authentication/roles middleware reloads current user state. Suspension
  marks all sessions revoked; the next protected call destroys its session.
  Reactivation requires new login even when a session was unused while suspended.
- Property create/read/edit/archive and availability updates with landlord
  ownership checks. Guest create is 401, prohibited role is 403, unrelated
  property is 404. Owners cannot edit/reopen archived listings or undo hidden
  visibility through availability changes.
- Public search and details; landlord management reads; combined filters,
  stable sort, database pagination/totals and batch image lookup. Money remains
  a decimal string and move-in date remains a calendar date.
- Property image upload/read/order/removal: actual content decoding,
  JPEG/PNG/WebP re-encoding/metadata removal, 5 MiB/file, 8 images/property,
  generated storage keys, count locking, failure cleanup and private media checks.
- Admin user listing/status transitions with required reasons, no self-suspend,
  and transactional status audit.
- Out-of-band admin provisioning and read-only upload reconciliation report.
- OpenAPI 3.1 for all 19 M3 operations, configuration example, setup instructions,
  architecture/ERD and acceptance documentation.

No M4 viewing/favourite/report/freshness business logic or tables were added.
No existing frontend file was edited. No Docker or CI configuration was invented.

## Verification actually executed

Environment: Node 24.21.0 and PostgreSQL 18.6 on this machine. A temporary
localhost PostgreSQL cluster on port 55432 supplied `homefinder_test`.
Integration tests created/dropped unique schemas with no public-schema fallback;
no development/production database was touched.

| Check | Result |
| --- | --- |
| Initial `npm run test:auth` | 18 tests passed before property implementation |
| Property feature suite | 12 tests passed before photo implementation |
| Initial image/admin feature suites | 7 tests passed |
| Final `npm test` | 7 files, 42 tests passed |
| `npm run lint` | Passed |
| `npm run check:api` | OpenAPI 3.1, 19 operations validated |
| `npm run db:migrate` on empty temporary DB | All four migrations applied |
| Repeat `npm run db:migrate` | No migrations reapplied |
| Live server HTTP smoke | Startup, health, register, login, create/list/detail property, logout and old-cookie rejection passed |
| Dependency installation audit | npm reported zero vulnerabilities at installation time |

Security tests include public admin/mass-assignment rejection, bcrypt byte limits,
normalized duplicate emails, generic bad credentials, session rotation, logout,
current database roles, suspension/revocation/reactivation, authenticated CSRF,
production cookie attributes, rate/body limits, ownership, SQL-like filter text,
private listing/media exclusion, invalid/oversized images, exactly eight versus
nine files, concurrent upload limits, image failure cleanup and audit rollback.

The initial sandbox auth test attempt failed because localhost database access
was blocked (EPERM); the authorized rerun and final suite passed. Dependency
installation needed network access and one timeout retry. PostgreSQL creation
needed permission to allocate shared memory. These failures are not counted as
passing tests.

Not verified: live Angular integration/browser journeys, Docker restart/volume
persistence, backups, deployment, CI, another teammate's environment, runtime
performance benchmarks, or production operational hardening. There is no lint
or build claim for the untouched frontend. The API is JavaScript and requires
no transpilation/build stage.

## Important integration decisions

- API contract: `docs/api.yaml`, rooted at `/api/v1`; it supersedes older
  illustrative README examples. Current property DTO matches M1's existing
  interface, including all list/card fields, nullable landmarks/freshness,
  images, decimal strings and date-only move-in fields.
- No automatic login on registration. M2 should log in separately, initialize
  state from `/auth/me`, and send cookie credentials through the same-origin
  proxy. Mutation requests require exact APP_ORIGIN or matching Referer;
  no separate CSRF-token endpoint/header is needed for this chosen strategy.
- `expires_at IS NULL` means no expiry assigned; non-null expired rows are
  excluded. M3 does not assign a 30-day freshness period. M4 must review this
  convention before adding confirmation/renewal.
- Accept valid past move-in dates because the proposal left a new-post future
  restriction undecided. No arbitrary date cutoff was invented.
- Uploaded files and DB cannot commit atomically across crashes. The normal
  failure path cleans files; a crash/failed unlink can leave inaccessible
  orphan files. `npm run uploads:check` provides a read-only reconciliation
  report; see backend/README.md for the procedure.
- Node runtime is pinned to 24.x in package engines (local .nvmrc: 24.21.0).
  Default shell Node 20 must be switched before running the backend.

## Team follow-up

| Owner | Concrete dependency |
| --- | --- |
| M1 | Run current Angular browse/detail against this API; confirm list fields, pagination, money/date presentation and media URLs. No client changes were made here. |
| M2 | Integrate auth initialization/login/logout, landlord forms/uploads and admin account-status UI. Handle 401/403/404/409 envelopes. |
| M4 | Reuse auth/roles/transaction helpers, agree migration numbers after 0004, add own tables, and lock/recheck property availability for new viewings. Review null expiry before freshness. |
| M5 | Node 24, PostgreSQL service/CI test database, migration-before-start, reverse proxy and exact proxy trust, HTTPS secrets, durable upload volume, backups/restart verification. A shared rate-limit store is needed for multiple API replicas. |

No teammate messages were sent and no reviewer approval was fabricated.

## Review status

All changes are uncommitted in the original checkout. Creation of
`codex/m3-backend` was attempted, required Git write approval, and was declined.
No commit to main, push, PR or merge was performed. The user's original
untracked specification was preserved. Focused PR text and separation guidance
are in `docs/api/M3-pr-drafts.md` for use once a feature branch is available.
