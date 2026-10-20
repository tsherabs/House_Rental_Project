# M3 backend acceptance criteria

The implementation specification is the feature blueprint. Team approval of its
M3 baseline was confirmed on 20 October 2026; see decisions/0001-m3-baseline.md.
This document covers M3 only, not completion of the entire application.

- B03/B04: register seekers/landlords only; normalize and uniquely constrain
  email; hash passwords; login with PostgreSQL session rotation; logout
  invalidates sessions; current account comes from database. Reject invalid
  roles, mass assignment, suspended accounts and unauthorized mutations.
- Database: versioned transactional migrations under database/migrations,
  enforced constraints/indexes, safe reruns and immutable applied checksums.
- B05/B12: landlords create/edit/read/archive only their own properties. Owner
  identity is immutable through the API. Availability changes immediately
  affect public queries. Archive preserves relational history references.
- B07/B08: public listing/details enforce visibility, availability, expiry and
  owner status. All supplied filters combine; allowlisted sorts are stable;
  pagination totals are accurate. Decimal money stays text; dates stay dates.
- B06: owner-only bounded image uploads, actual decoding/content validation,
  generated storage keys, ordered images, transaction-protected count limits,
  removal and failure cleanup. Media access follows property visibility.
- B14: only admins list users or change status. Require a reason, prevent
  self-suspension and atomically audit transitions. Suspension revokes existing
  sessions; reactivation cannot revive them.
- Security: origin-based CSRF protection, HttpOnly cookies, production Secure
  cookies, explicit proxy trust, rate limits, bounded bodies, strict validation,
  parameterized values, no password/session/path/SQL leakage in responses.
- Verification: real PostgreSQL auth/session/ownership integration tests,
  isolated test schema/database, lint, valid OpenAPI, documented startup.

M4 owns viewing requests, favourites, listing reports, moderation and freshness
workflows. M1/M2 own frontend integration and M5 owns deployment/persistence
verification. Their completion must not be inferred from passing backend tests.
