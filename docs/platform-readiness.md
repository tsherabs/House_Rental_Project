# Platform enhancement and verification report

Completed 23 October 2026. This report covers the integrated platform enhancement and the follow-up operational fixes and documentation. It is evidence of local verification, not approval for a public launch.

## Features available to test

- Compare up to three homes, retaining only their identifiers in browser storage. Current public details are fetched again on entry or refresh; inaccessible homes show an unavailable state.
- Estimate move-in costs from the listed rent and deposit, the selected number of rent months, and optional moving/utility estimates. Integer minor-unit arithmetic avoids decimal rounding errors. No payment is collected.
- Read a private notification inbox with pagination, unread filtering and idempotent marking as read. Viewing requests and decisions notify the relevant participant; report review and moderation notify the reporter or owner. Event changes and notifications commit atomically.
- Use the existing seeker, landlord and administrator workflows with role-based navigation and server-side authorization. A footer link opens the new role guide, with a downloadable PDF.
- Run a packaged Angular/Caddy/Express/PostgreSQL preview with private API/database ports, persistent volumes, migration ordering, readiness checks, rotated logs and shared database request limits.

## Follow-up fixes

The Windows-to-container rebuild exposed a checksum mismatch caused only by CRLF/LF conversion in migration 0007. The migration runner now stores normalized LF checksums and accepts historical LF/CRLF hashes without rewriting applied migration records. Actual SQL changes still fail. A regression test verifies both compatibility and tamper rejection; Git attributes preserve LF for migration checkouts.

Database pool connections have a five-second acquisition timeout and readiness queries a four-second query timeout. These bound database-unavailable checks. The new frontend test configuration limits concurrency to two workers after an unrestricted run encountered worker startup timeouts while the machine was also building containers. The bounded rerun passed all tests.

The migration and timeout changes reuse the shared database foundation. No applied SQL migration content, authentication mechanism, renewal rule or existing endpoint format was changed by this follow-up.

## Verification actually completed

| Check | Result |
| --- | --- |
| Backend integration suite | 61 tests passed in 11 files against a dedicated PostgreSQL test database with isolated schemas |
| Backend lint | ESLint passed |
| API contract | OpenAPI 3.1 validation passed for 37 operations |
| Angular tests | 52 tests passed in 9 files with two workers |
| Angular production build | Passed; initial bundle 303.95 kB raw, approximately 85.09 kB estimated transfer |
| Docker builds and startup | Both images built; database and API healthy; migration service completed with no pending migrations on rebuild |
| Packaged API smoke | Registration, login, listing creation, photo upload, viewing request/acceptance, inbox ownership, favourites, foreign-origin rejection and SPA fallback passed |
| Restart persistence | Existing sessions, listing data, inbox messages and uploaded image remained accessible after container restart/rebuild |
| Database backup restore | PostgreSQL custom-format dump restored successfully into separate homefinder_restore_check database; notification records verified |
| Uploaded-file restore | Backup extracted into a separate temporary directory; restored image matched the live preview image byte-for-byte |
| Browser journeys | Two-home comparison, budget calculation, seeker request, landlord inbox/read filter, landlord acceptance and seeker acceptance notification verified |
| Responsive UI | Comparison and inbox checked at 390px and desktop widths; table scroll stays inside its container, with no page-wide horizontal overflow |
| User guide | Five-page PDF rendered and every page visually inspected; in-app help link verified |

The backend suite includes notification privacy, missing/foreign ownership, suspended-account blocking, CSRF, transactional rollback, shared concurrent limits, readiness, migration compatibility and the existing auth/property/viewing/moderation regressions. Angular tests cover comparison storage limits, unavailable listings, exact and invalid cost inputs, reactive updates, inbox rendering/filtering/read actions and existing role workflows.

The first restart check briefly encountered the proxy before it accepted connections; the smoke script now waits for readiness before testing. The first rebuilt migration failed on the line-ending mismatch described above; the corrected rebuild and persistence check passed. No failed run is counted as a pass.

## Changed areas and deliverables

| Area | Files or directories |
| --- | --- |
| Shared database reliability | backend/src/db/migrate.js, backend/src/db/pool.js, backend/src/app.js, backend/tests/migrations.test.js, .gitattributes |
| Frontend usability and tests | frontend/src/app/app.html, frontend/src/app/features/properties/comparison-page.ts, frontend/angular.json, frontend/vitest-base.config.mts |
| API and decisions | docs/api.yaml, docs/decisions/0003-platform-readiness.md |
| User documentation | docs/user-guide.md, frontend/public/help.html, frontend/public/user-guide.pdf, output/pdf/Thimphu_HomeFinder_User_Guide.pdf |
| Operations documentation | docs/deployment.md, this report, README.md |
| Reproducible checks | scripts/smoke-containers.mjs, scripts/build-user-guide.py |
| Visual evidence | docs/screenshots/homefinder-inbox.png, docs/screenshots/homefinder-inbox-mobile.png |

The earlier merged enhancement also includes migration 0007, notification routes/service, request-limit middleware, domain event hooks, comparison/budget/inbox Angular components, their tests, Dockerfiles, compose.yaml, Caddy configuration and the GitHub verification workflow.

The existing seeded demo is at http://127.0.0.1:4200/properties. The separate Docker preview is at http://127.0.0.1:8080/properties. Credentials and data do not transfer between their databases. Test accounts and operational secrets remain in ignored local files, never in the deliverables. See local-demo.md for the synthetic development accounts and deployment.md for container setup.

The guide source is docs/user-guide.md. Rebuild its public HTML and PDF with scripts/build-user-guide.py in a documentation Python environment containing reportlab; render and inspect the resulting PDF before publishing an edited version. The PDF in output/pdf and the frontend download are the same artifact.

## Remaining launch dependencies

- M3/M4 must review the proposed 30-day renewal, initial null-expiry behavior, duplicate/overlap and cancellation rules. No approval or change to those rules is implied by this enhancement.
- M5 must configure real hosting, a domain, production HTTPS, secrets, backup scheduling, monitoring, release rollback and branch protection. Public TLS, production traffic capacity and off-host recovery have not been verified locally.
- The operator must provide support/contact details, a verified account recovery process, appropriate privacy/terms material and retention/deletion procedures. Self-service password recovery, email verification and email/SMS/push delivery are not implemented.
- Notifications have no retention-cleanup job. Multiple API replicas require shared media storage in addition to the existing shared sessions and rate limits.
- Replace fictional demo listings and illustrative property photos with authorized real content. No live payment, tenancy contract, identity-verification or calendar-booking integration is claimed.
- Teammate review and GitHub CI results must be checked on the pull request. Local checks do not prove a remote workflow has run or passed.
