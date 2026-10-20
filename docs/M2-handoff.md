# M2 frontend delivery — 20 October 2026

## Inspection and contract hierarchy

Read the complete supplied implementation specification and current README, requirements, M3 decision, backend handoff, OpenAPI operations/schemas and matching backend routes/validation. No AGENTS.md exists in the repository or inspected ancestor directories. The repository copy and Downloads copy of the specification differ only in line endings. Existing M1 Angular 22 components, routes, models, styling and Vitest setup were reused; no dependencies or backend files were changed.

The approved decision `docs/decisions/0001-m3-baseline.md` supersedes proposed defaults: Origin/Referer CSRF (no token endpoint), separate login after registration, valid past move-in dates, null expiry convention and archived-property restrictions. Existing M3 OpenAPI is consumed unchanged. No API/schema or environment-contract changes were necessary; root `.env.example` already contains the required settings.

## Implemented

| Slice | Main files | Behavior |
| --- | --- | --- |
| B03/B04 auth | `frontend/src/app/core/auth/`, `features/auth/` | Login/register/logout, startup current-account read, in-memory user state, UTF-8 password limits, email normalization, validation summaries, safe return URLs, role guards, cookie credentials, session failures |
| Shared application | `app.ts`, `app.html`, `app.config.ts`, `app.routes.ts`, `shared/` | Role navigation, guarded lazy routes, XHR upload support, pagination and form feedback; original M1 browsing preserved |
| B05/B06/B12 landlord | `features/landlord/` | Owner dashboard/pagination, listing create/edit, facilities, decimal prices, availability/archive confirmations, photo previews/count/size checks/progress/upload/remove/order, canonical refresh |
| B14 administrator | `features/admin/` | Dashboard, user filters/pagination, suspension/reactivation with reason/confirmation, no self-suspension, canonical refresh and safe error states |

Shared auth refinements include an 8-second initialization timeout, rechecking 403 responses rather than confusing a rejected CSRF request with successful logout, and no credentials on unrelated external requests. Navigation wraps on narrow screens. Descriptions and server feedback use Angular text bindings.

## Verification actually run

- Production `npm run build`: passed, including strict TypeScript and template checks.
- `npm test -- --watch=false`: **6 files, 36 tests passed**, including the 10 existing M1 tests. Tests cover actual Angular routing and mocked HTTP boundaries; they are not database/browser end-to-end tests.
- Earlier auth slice: 19 tests passed. Landlord slice: 27 tests passed after correcting a test that retained a destroyed route component. Initial sandbox run failed to access runner-generated temporary files; authorized reruns passed.
- Tests cover auth payloads/state, no auto-login, password UTF-8 limits, roles/redirects, expired/forbidden sessions, role navigation, failed logout, management reads, mutable-only property writes, dates/money, archive confirmation, multipart images, upload constraints/reordering, admin self-protection/reasons/confirmation/filtering/conflicts.
- Prettier applied to M2 source and shared shell; `git diff --check` passed. No frontend lint script is configured.
- Angular dev server started. Browser opened `/login` and displayed the sign-in form, guest navigation and account-service-unavailable state. Subsequent browser-control handles expired, so a full visual/mobile audit was not completed.
- Live integration was **not** verified: no `.env`, backend `node_modules`, or running PostgreSQL instance was present in this checkout. M3's prior test report is not evidence that these new frontend flows ran against a live database.
- No deployment, CI pass, teammate review or merge is claimed.

## Remaining dependencies

- **M3:** run this frontend with the real Express/PostgreSQL environment. Verify session cookie rotation/logout, CSRF origin, private management/media reads, photo upload persistence, account-status/session revocation and server error paths. Do not weaken origin checks to make integration pass.
- **M4:** viewing accept/reject and report moderation are intentionally pending. No approved DTOs or routes exist for these modules in the current canonical API/backend. Supply received-viewing, history, report and moderation schemas, then M2 can implement the remaining screens without guessing. Confirm migration/lifecycle conventions with M3.
- **M1:** review shared navigation and consume the single AuthService for seeker protection; no seeker forms/favourites were implemented by M2.
- **M5:** validate HTTPS/same-origin proxy, exact APP_ORIGIN and trusted proxy configuration, Node 24, media volumes, SPA fallback, CI and a second-machine setup.

## Review order

The feature branches are stacked and must merge in order; each subsequent PR should target the preceding branch until that branch merges, then retarget as appropriate:

1. `codex/m2-auth` → `main`: B03/B04 authentication.
2. `codex/m2-landlord` → `codex/m2-auth`: B05/B06/B12 listings/photos.
3. `codex/m2-admin-users` → `codex/m2-landlord`: B14 administrator accounts.
4. `codex/m2-integration-checks` → `codex/m2-admin-users`: shared session edge-case tests/refinements, formatting and final integration documentation. This final branch contains the complete implementation.

Focused handoffs: `M2-auth-handoff.md`, `M2-landlord-handoff.md`, `M2-admin-handoff.md`. No issue numbers or reviewer identities were supplied. Branch publication and actual PR creation status must be reported from tool results, not inferred from prepared descriptions.
