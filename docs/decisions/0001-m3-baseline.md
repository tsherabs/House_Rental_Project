# M3 backend baseline

Date: 20 October 2026.
Status: baseline approved by the team, as confirmed by M3 in this chat.
Named approvers were not supplied; this does not claim a separate review or merge.

The user confirmed “Yes—team approved the proposed M3 baseline.” Implement
specification sections 5–7 for M3 using JavaScript ESM, Node 24 LTS, Express,
PostgreSQL, pg, Zod, bcrypt, PostgreSQL-backed express-session, Multer, Vitest
and Supertest. Keep UUIDs, decimal money strings, UTC instants, camelCase JSON,
/api/v1 and the specified endpoints. This supersedes the illustrative README
registration example. No JWT or parallel migration system is introduced.

Implementation choices within that baseline:

- CSRF uses exact configured Origin matching, with Referer-origin fallback;
  unsafe requests without either are rejected, including login/registration.
  SameSite=Lax supplements this check. Use the Angular same-origin proxy.
- Audit account-status changes in account_status_history in the same transaction.
- Unrelated private resource access returns 404; prohibited roles return 403.
- Null expires_at means no expiry has been assigned yet and does not exclude a
  listing. A non-null expiry is enforced by public queries. No 30-day policy,
  confirmation endpoint or freshness job is implemented by M3. M4 must review
  this interim integration convention before enabling freshness.
- Accept any valid ISO move-in date; the baseline's new-post date restriction
  was explicitly left for agreement. Existing dates must remain editable.
- Archived listings remain readable in owner management but cannot be edited,
  uploaded to or reopened through availability. Repeating archive is harmless.
- Existing hidden state cannot be changed by ordinary owner edits/availability.
- Tests use a separate PostgreSQL database and isolated schema. No development
  tables are truncated. SQL migrations are immutable after application.
- Login/register limits are per process/IP. M5 must provide a shared limiter
  store if deploying multiple API replicas. Trust proxy defaults to disabled;
  deployments must explicitly configure trusted proxy addresses.

M4 retains viewings, favourites, reports/moderation and freshness business logic.
Their tables/migrations must be coordinated; this slice creates only M3 tables.
M1/M2 must verify UI integration; M5 owns containers and deployment.
