# M4 handoff — 21 October 2026

## Delivered

- Six viewing endpoints: seeker create/list, landlord received list, participant
  detail with history, landlord accept/reject, requester cancellation.
- Atomic initial and transition histories; ownership checks; row locks serialize
  concurrent decisions. Creation locks and rechecks public listing eligibility.
- Idempotent seeker favourites; unavailable saves retain their identifier with
  `available: false` and `property: null` without disclosing private listing details.
- Reports, pending-duplicate protection, admin review with actor/time/reason,
  separate audited listing hide/unhide, and terminal review validation.
- Owner confirmation for 30 days and an expiring-listings page. Rental/moderation
  status is preserved; archived listings cannot be restored by renewal.
- Angular request/report forms, favourite lists, private viewing history, landlord
  decisions, administrator review/moderation and listing confirmation pages.
- Responsive browsing hero, property cards, landlord photos and sign-in backdrop,
  using locally stored generated illustrative images. Six fictional demo listings.

## Changed areas

Backend: `src/routes/{viewings,community}.routes.js`, corresponding services,
`src/app.js` router wiring, and `tests/{viewings,community}.test.js`.
Database: append-only migrations `0005_viewings.sql` and `0006_favourites_reports.sql`.
Contract: `docs/api.yaml` now documents 34 operations, including all 15 M4 additions.
Frontend: `features/community/`, routing/navigation, property detail actions,
landlord/admin dashboard links, browsing/card/auth styling, and `public/images/`.
Demo: `backend/scripts/seed-demo.js`, `scripts/start-local.ps1`, `docs/local-demo.md`.

M3's authentication, database pool/runner, user management and property services
were reused. No existing migrations or M3 service implementations were replaced.

## Verification actually run

- PostgreSQL 17.4, isolated local instance on port 55433; distinct `homefinder_test`
  database and a fresh generated schema per test file.
- Backend: **53 tests passed in 9 files**, including 11 new workflow tests.
  Covers anonymous/wrong-role/unrelated-owner access, strict validation, unavailable
  listings, suspended sessions, concurrent viewing decisions and report reviews,
  audit-write rollback, idempotent favourites, moderation audit and renewal rules.
- Backend ESLint passed. OpenAPI 3.1 validation passed: **34 operations**.
- Frontend: **45 tests passed in 7 files**, including 9 new workflow tests covering
  Bhutan-time conversion, invalid requests, busy state, role-specific controls,
  unavailable saved homes, independent report/visibility actions and confirmation.
- Final production Angular build passed (301.73 kB initial raw bundle).
  The changed frontend files pass formatting; whole-tree `prettier --check src`
  still flags pre-existing shared files. Those files were not reformatted.
  No deployment or CI pass is claimed.
- Browser: real cookie login as seeker; save a home and submit a future request;
  landlord login and accept; verify pending/accepted history. Administrator login,
  hide and unhide a fictional listing, then record its report review.
- Browsing verified at 390px and 1280px viewports: images loaded and no horizontal
  overflow. Screenshots: `screenshots/homefinder-mobile.png` and
  `screenshots/homefinder-desktop.png`. The viewport override was reset afterwards.
- `scripts/start-local.ps1` verified the running app through its proxied health endpoint.
- All six migrations applied to the empty demo database. The existing migration
  regression test verifies repeat application, checksum protection and rollback.

## Dependencies and review decisions

`decisions/0002-m4-workflows.md` records the implementation choices as **proposed**,
not team-approved. Before merge, M3/M4 must review the 30-day renewal and null-expiry
compatibility policy, pending-report uniqueness, and viewing cancellation rules.
New M3 listings retain null expiry until confirmation; universal initial expiry
would require a coordinated change to M3's create workflow.

M1/M2 should review the new DTOs and Angular integration; M5 should wire migrations,
test DB, uploaded-file persistence, startup and deployment into CI/containers.
There are no Docker/deployment changes in this slice. No external team messages
or approvals have been fabricated. Existing viewed requests survive hidden,
rented and expired listings; no automatic cancellation policy was invented.

The review branch is based on the existing M2 integration branch, because the
current app depends on that work. Merge/rebase order must preserve those changes.
