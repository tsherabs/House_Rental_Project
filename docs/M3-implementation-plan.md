# M3 backend implementation plan

Prepared: 20 October 2026. Updated status: team approval confirmed by M3;
implementation completed and verified with 42 tests. See M3-handoff.md for
executed checks and outstanding integration. The inspection/approval notes
below are retained as the original plan, not current blockers.

## Repository findings

- Read the complete `Thimphu_HomeFinder_Implementation_Spec.md`, root README,
  frontend README, M1 handoff, frontend package manifest, property DTO/service,
  and development proxy.
- No repository or ancestor `AGENTS.md` was found.
- There is no `backend/`, `database/`, `docs/api.yaml`,
  `docs/requirements.md`, or `docs/decisions/` implementation to extend.
- The Angular public listing/detail slice exists. It uses `/api/v1`, camelCase
  fields, decimal money strings, UUID-compatible string IDs, image URLs, and
  `{data,pagination}` / `{property}` envelopes.
- Development `/api` requests already proxy to port 3000.
- The README's `/api/auth/register`, integer ID and message envelope are
  explicitly illustrative. They differ from the specification's proposed
  `/api/v1/auth/register`, UUID and `{user}` contract; neither is an approved
  canonical contract.
- M1's handoff explicitly describes the frontend contracts as pending
  confirmation. Existing frontend implementation is not evidence of backend
  approval.
- Current branch is `main`. The specification is an existing untracked user
  file and must be preserved. Implementation should use focused feature
  branches, with no direct commits to main.

## Original approval gate (now resolved)

The user's request says: “If an important choice is still marked proposed, use
it only after team approval.” The specification labels its backend choices
PROPOSED; no approval records were found.

Before implementing dependent code, confirm team approval for:

1. Backend JavaScript ESM, supported Node LTS, `pg`, Zod, bcrypt,
   express-session with PostgreSQL store, Multer, Vitest and Supertest.
2. UUID identifiers, users/session schema, numbered SQL migrations, camelCase
   DTOs, `/api/v1`, and the specification's error envelopes.
3. Cookie sessions, session lifetime, registration without automatic login,
   password limits, and CSRF mechanism. Proposed concrete CSRF implementation:
   verify Origin against configured `APP_ORIGIN` on mutations, fall back to
   the Referer origin, and reject absent/untrusted origins; this also protects
   login and registration.
4. Separate property visibility/availability, soft archive, the public
   availability predicate, and the null-expiry policy to agree with M4.
5. JPEG/PNG/WebP, 5 MiB per file, 8 images per property, and persistent local
   storage.
6. Durable account-status audit, including whether to approve the proposed
   `account_status_history` table; no self-suspension.

Record actual approval and any deviations in dated decisions. Do not label
this plan or generated code as team-approved. Freshness duration, new-listing
date rules, null expiry and archived-listing transitions need explicit
resolution where the baseline leaves alternatives open.

## Prioritized delivery slices

### 1. B03/B04: database foundation, authentication and access tests

- Add Express app factory and server entry point under `backend/src/`.
- Add one migration runner and versioned SQL under `database/migrations/`.
  Track applied filenames and checksums, execute each migration transactionally,
  serialize concurrent runners and reject modifications to applied migrations.
- Add users and session tables with constraints and indexes. Match the selected
  session adapter's schema rather than maintaining two session systems.
- Implement registration, login, logout and current-account endpoints exactly
  as specified in §7.1.
- Add strict validation, email normalization, bcrypt byte-length validation,
  generic login failures, request-size limits, rate limits and safe errors.
- Regenerate login sessions, destroy logout sessions, configure secure cookies,
  and reload current role/account status on every protected request.
- Export reusable authentication and role middleware for M4. Ownership checks
  will return a consistent 404 for missing or unrelated private resources.
- Update environment documentation and approved OpenAPI alongside implementation.

Tests must use a dedicated real PostgreSQL database, never the developer's
working database. Verify:

- Fresh migration and repeat migration; applied-file modification detection.
- Seeker/landlord registration; hash storage and omission from responses.
- Invalid email/password, duplicate normalized email, UTF-8 byte limits,
  rejected admin signup and rejected injected status/ID fields.
- Correct and incorrect login; identical invalid-credential errors.
- Session rotation and old-cookie rejection; logout invalidation.
- Missing session, prohibited role, changed role and suspended-account rejection
  using previously issued sessions.
- Allowed/foreign/missing Origin, cookie attributes and rate-limit responses.
- Parameterized values and nonleaking validation/database failures.

Run this slice's tests before property implementation.

### 2. B05/B07/B08/B12: properties and search

- Add property schema/index migration after shared schema review with M4.
- Implement owner-only create, read, edit, soft archive and availability update.
- Implement public list/detail and private landlord list/detail endpoints.
- Preserve decimal strings, date-only fields and the existing Angular DTO.
- Apply AND filters, bounded pagination, accurate totals and allowlisted sorts
  with stable ID tie-breaking.
- Centralize the agreed public visibility predicate for integration with M4.
  Do not add confirmation, expiry jobs or viewing transitions.
- Test persisted CRUD, ownership, role denial, mass assignment, invalid UUIDs,
  combined filters, pagination boundaries, SQL-injection-like values and
  hidden/rented/expired/suspended-owner exclusions.

### 3. B06: property images

- Add image schema/index migration and the exact §7.3 endpoints.
- Authenticate and check ownership before accepting upload bodies.
- Validate actual content, count and size; generate server-controlled keys.
- Lock the property while enforcing image limits/order to prevent races.
- Clean up files on failed database writes; document recovery of orphaned or
  missing files without exposing disk paths.
- Serve bytes through visibility/owner checks with correct content type and
  safe cache/security headers.
- Test valid uploads, disguised media, oversize files, foreign ownership,
  concurrent count limits, ordering, removal and failed-write cleanup.

### 4. B14: account administration

- Add approved durable audit persistence.
- Implement admin user listing and status mutation, with strict filters/body
  validation, required reason, self-suspension prevention and atomic audit.
- Test admin-only access, immediate existing-session rejection, public listing
  exclusion, reactivation and durable audit.

## Integration handoff

| Member | Required agreement / verification |
| --- | --- |
| M1 | Full property DTO, pagination, date/money formats, image URLs; live Angular search/detail against PostgreSQL |
| M2 | Auth cookies, CSRF requests, `/auth/me`, registration/login flow, landlord forms and admin status UI |
| M4 | Migration numbering, shared schema, authentication exports, property locking/public visibility, null expiry and rented-listing checks |
| M5 | Supported Node runtime, PostgreSQL test service, reverse-proxy trust, secrets, migrations before startup, durable upload volume and CI |

No messages have been sent to teammates. Viewing requests, favourites,
reporting/moderation and freshness business logic remain M4's responsibility.
Docker/deployment changes require coordination with M5.

## Review and verification status

Prepare separate reviewable changes for foundation/auth, properties, photos and
account administration. Each PR should include relevant migration/API changes,
executed checks and remaining integration dependencies. Do not invent issue
numbers, approvals, remote PRs or successful CI results.

Observed tools: Node 20.20.2, npm 10.8.2, PostgreSQL client/server binaries 18.6,
and Docker CLI. GitHub CLI was not found. The frontend README documents Node 24;
reconcile the active backend runtime with the team before dependency installation.
Binary availability does not establish that a database or Docker daemon is
running.

At initial inspection no backend existed and no backend tests had run.
Implementation has since completed; see M3-handoff.md for current evidence.
No frontend files were changed.
