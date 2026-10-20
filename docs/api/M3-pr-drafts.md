# Focused M3 pull request drafts

These are prepared descriptions, not opened pull requests. No issue numbers,
reviewers or CI results have been invented. Branch creation was declined, so
all implementation changes remain uncommitted. The final full suite passes
42 tests; rerun each extracted slice's relevant tests before publishing it.

Use stacked feature branches or sequential PRs. Keep app route mounts and the
OpenAPI paths consistent with the features present in each slice. Do not move
only files while leaving imports pointing to a later slice.

## B03/B04 — add PostgreSQL-backed authentication and access controls

Adds the backend app/configuration, users and session migration, immutable SQL
migration runner, registration/login/logout/current-user endpoints and shared
active-account/role middleware. Login rotates sessions; logout destroys them;
CSRF checks, rate limits, bcrypt validation and strict fields protect mutations.

Include auth-specific OpenAPI/environment/setup documentation and migration,
authentication, authorization and configuration tests. The first auth slice was
verified with 18 tests before properties were added. M2 reviews authentication
integration; M4 reviews reusable middleware/schema; M5 reviews runtime/secrets.

## B05/B07/B08/B12 — add owned property management and public search

Adds property schema/indexes, owner-only CRUD/soft archive, available/rented
status and public/owner read APIs. Public queries enforce status, expiry and
active owners; filters combine with stable sorts and accurate database totals.
Property DTOs use M1's existing camelCase fields and decimal money strings.

Depends on authentication. Include the image-table migration needed by batch
image reads (upload handlers can follow separately), property OpenAPI and tests.
Property suite passed 12 tests. M1/M2 review DTO/forms; M4 reviews availability
and null-expiry integration before enabling viewings/freshness.

## B06 — add bounded property photo storage and management

Adds owner-authorized upload/read/order/removal. Decoded JPEG/PNG/WebP content is
re-encoded without metadata; transactional property locks enforce eight images
under concurrent uploads. Private media uses visibility checks; failed database
writes remove created files and missing bytes return safe 404s.

Depends on property/image schema. Include upload reconciliation command,
OpenAPI and image tests (five cases in the final suite). M2 reviews forms;
M5 reviews storage volume, recovery and deployed proxy behavior. Container
restart durability has not been verified.

## B14 — add audited administrator account controls

Adds admin user filters/status transitions and a durable status-history
migration. It rejects self-suspension, requires a reason, atomically records
audits and revokes existing sessions so reactivation requires a new login.

Depends on auth; include auth revoked-session handling and private-media
revocation check when the photo slice is present. Admin suite passed four tests
in the final regression run. M2 reviews admin UI; M4 reviews shared account
status effects. No public role-escalation or moderation endpoint is added.
