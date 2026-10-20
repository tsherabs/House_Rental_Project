# M2 authentication slice — B03/B04

Uses the approved M3 baseline in `docs/decisions/0001-m3-baseline.md` and existing `docs/api.yaml`. No backend, endpoint, schema, dependency or authentication mechanism was changed.

Implemented: login/registration, separate sign-in after registration, server logout, startup `/auth/me`, in-memory safe user state, reusable role guard, session interceptor, safe local return URLs, validation summaries, UTF-8 password byte validation and role-aware shared navigation. Public signup offers seeker/landlord only; admin provisioning stays server-side.

All requests use the same-origin `/api/v1` proxy and cookie credentials. M3's Origin/Referer CSRF policy is enforced by the server; the browser supplies these headers. No invented CSRF token route, JWT or browser token storage is used. A failed account-service initialization leaves public browsing usable and protected routes fail closed. Guards improve UX only; server role/ownership checks remain mandatory.

Application HttpClient uses XHR so the following photo slice can report upload progress. Existing M1 property routes/components/services are preserved. Shared navigation is extended within the M2 assignment.

M3 auth integration must run with `APP_ORIGIN=http://localhost:4200` (or the exact actual browser origin). Production requires HTTPS and same-origin reverse proxying. No frontend environment variables or secrets were added; `.env.example` already documents the required backend values. OpenAPI is unchanged because no contract changes were needed.

Review request: M1 checks navigation compatibility; M3 checks cookie/CSRF integration. Automated test and final delivery evidence is recorded in `docs/M2-handoff.md` after all slices are complete.
