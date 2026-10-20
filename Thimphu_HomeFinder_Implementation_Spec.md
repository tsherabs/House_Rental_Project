# Thimphu HomeFinder — Full-Stack Implementation Specification and Agent Handoff

**Version:** 1.0 proposed baseline · **Prepared:** 20 October 2026  
**Status:** **PROPOSED FOR TEAM APPROVAL — NOT AN IMPLEMENTATION REPORT**  
**Repository:** `house-rental-app/` · **Product:** rental discovery and viewing management for Thimphu

> **Read this first, human or AI agent.** This is a build-ready *proposed* contract derived from the team's draft documentation and backlog, expanded with explicit engineering choices where the draft left gaps. Angular, Express, PostgreSQL, Scrum, five collaborators, the project purpose, repository layout, and broad feature requirements come from the supplied draft. Everything labelled **PROPOSED** below (including exact endpoints, cookie authentication, field constraints, upload limits, and lifecycle rules) is **not yet team-approved**. Before coding in an existing repository, inspect its actual files and any approved decisions. Approved `docs/decisions/` records and an existing `docs/api.yaml` supersede this proposal; do not silently replace working contracts. This file does **not** claim the app, tests, deployment, or settings exist.

## 0. Implementation order for an AI coding agent

1. Read `AGENTS.md`, this specification, `README.md`, `docs/requirements.md`, `docs/api.yaml` (if present), and `docs/decisions/`; inspect actual code and `package.json` scripts.
2. Report any conflict between approved materials and this specification. If a decision is unresolved, ask the team to approve the proposed baseline before merging dependent work. Independent scaffolding, tests, and drafts may proceed on a feature branch.
3. Preserve existing work; don't overwrite Angular, Express, migrations, or CI infrastructure merely to match a diagram. Never create competing authentication or migration systems.
4. Implement in vertical slices: **auth + access tests → migration/DB → properties → images/search → viewings → favourites → moderation/freshness → integration/CI/deployment**. Parallel ownership is in §3.
5. Each change requires relevant automated tests, OpenAPI updates, security/authorization verification, `.env.example` updates, and a pull request description. State exactly which checks ran.
6. No agent may declare an endpoint complete solely because a handler exists: verify DB persistence, role checks, frontend integration, and failure cases.

## 1. Product goals and scope

### Problem and users (source-derived)

People seeking accommodation in Thimphu need understandable rental prices, facilities, location information, photos, and reliable availability. Landlords need to publish and manage listings. Administrators moderate misinformation and accounts. The team has **not** supplied independent market research or user survey evidence.

Roles: **seeker**, **landlord**, **admin**. One active role per account **(PROPOSED)**. A seeker browses, saves favourites, compares properties (optional), and requests viewings. A landlord manages *only their own* listings and their viewings. An administrator moderates reports and suspends/reactivates users; admins are created only through an authorized seed/provisioning procedure, never public registration.

### Backlog scope and priority

| ID | Capability | Priority | Lead (proposed) |
|---|---|---|---|
| B01–B02 | Repository/setup, requirements, wireframes, contracts | Must | All; M5 coordinates |
| B03–B04 | Register/login/logout; role and ownership authorization | Must | M3 + M2 UI |
| B05–B06 | Landlord listing CRUD; photo upload | Must | M3 + M2 UI |
| B07–B08 | Browse/filter/page; property details | Must | M3 API + M1 UI |
| B09–B11 | Viewing request, landlord accept/reject, history/visibility | Must | M4 API + M1/M2 UI |
| B12 | Mark rented; no new viewings | Must | M3 API with M4 integration |
| B13 | Reporting/moderation | Must | M4 API + M2 UI |
| B14 | Suspend account | Must | M3 API + M2 UI |
| B15 | Persistent favourites | Should | M4 API + M1 UI |
| B16 | Confirm listings/expire/renew | Should | M4 API + M3/M5 integration |
| B17 | Automated checks for PRs | Should, **start in first iteration** | M5 + all |
| B18 | Deployed integrated app, persisted DB/photos | Must | M5 + all |
| B19 | Evidence, written report, team presentation | Must | All |
| B20 | Property comparison and move-in costs | Optional | M1 UI + M3 API support if needed |

**Scope boundary:** M3 must **not** implement viewing, favourite or report business logic; M4 owns those. Shared DB migrations, auth middleware, and schema constraints are coordinated between M3/M4.

## 2. Architectural choices and technology

**Confirmed in draft:** Angular frontend, Node.js/Express backend, PostgreSQL, Scrum, GitHub collaboration.

**PROPOSED executable baseline (confirm in `docs/decisions/`):**

- Frontend: Angular current project-supported stable version, TypeScript, Angular Router, HttpClient, Reactive Forms; standalone components if creating a new Angular project; component-scoped CSS. Do not force upgrades in an existing Angular app.
- Backend: Node.js active LTS supported by existing dependencies, Express, **JavaScript ES modules** (or keep TypeScript if already selected), `pg` for PostgreSQL, `zod` request validation, `bcrypt` password hashing, `express-session` + PostgreSQL session store, `multer` for uploads. Pin installed versions with lockfiles, not arbitrary unverified version numbers.
- Database migration mechanism: plain numbered SQL migrations driven by one migration runner (or retain an established tool); PostgreSQL `BEGIN/COMMIT`, schema_migrations table, forward-only changes.
- Testing: Vitest or Jest + Supertest (choose one; avoid parallel frameworks); isolated PostgreSQL test DB for integration tests; Angular's already configured test runner.
- Runtime: browser → Angular → `/api/v1/*` Express → PostgreSQL. Session cookie sent with credentials. Backend owns authorization; frontend guards only improve UX.
- Local deploy: separate Docker containers for frontend, API, PostgreSQL, and durable image storage volume; CI on GitHub Actions. Reverse proxy serves frontend and `/api` on same origin in deployed environment.
- **Not in MVP:** online payments, real-time chat, geocoding, ML matching, microservices, Kubernetes. No mortgage/transaction features.

### Proposed architecture

```text
Browser (Angular SPA)
   │ same-origin /api/v1 (production), /api dev proxy
   ▼
Web server/reverse proxy ─── Angular static assets
   │
   └────────────► Express routes → controllers → services → repositories/pg
                            │                          │
                            │                          ▼
                            │                       PostgreSQL
                            └── protected upload endpoint → persistent photos volume
GitHub PR → lint/test/build → reviewed merge → container deployment
```

## 3. Responsibility matrix and collaboration rules

**Proposed mapping; replace M1–M5 with real team names after approval.**

| Member | Primary code ownership | Required reviewers/integration |
|---|---|---|
| M1 frontend | Seeker search/details, viewing forms/history, favourites, compare UI | M3 for listing contract; M4 for viewing/favourite contract |
| M2 frontend | Registration/login, landlord dashboard/listing editor, admin views | M3 for auth/properties/users; M4 for moderation |
| M3 backend | DB foundation, auth/session, roles, account status, property CRUD/search/photo endpoints | M2 auth/landlord UI, M1 browsing, M4 schema |
| M4 backend | Viewings/status history, favourites, reports, freshness/renewal | M1/M2 UI, M3 schema/auth integration |
| M5 DevOps | Docker Compose, CI, deploy, environment docs, integration support | All validate actual run/build/test |

Workflow: issue links Bxx → branch `feature/B03-auth` → focused commits → local checks → PR to protected `main` → at least one teammate reviews and CI passes → merge. Never commit to `main` directly or force-push shared branches. Coordinate schema and API changes before PR approval. Scrum: short stand-ups, sprint planning, working demo, retrospective. No fixed sprint dates or member identities were supplied.

**Definition of Done:** acceptance criteria met; server-side permission checks; validations and safe errors; tests pass; database migration reviewed; OpenAPI aligned with implementation; Angular uses API rather than permanent mocks; no secrets; reviewer approval; demo evidence.

## 4. Repository structure (target; preserve actual layout where it already exists)

```text
house-rental-app/
├── AGENTS.md
├── frontend/
│   ├── src/app/
│   │   ├── core/{auth,guards,interceptors,services}/
│   │   ├── shared/{components,models}/
│   │   └── features/{auth,properties,landlord,viewings,favourites,admin,compare}/
│   ├── src/environments/
│   ├── proxy.conf.json
│   ├── package.json
│   └── Dockerfile
├── backend/
│   ├── src/
│   │   ├── app.js                    # express app factory, no listen side effect
│   │   ├── server.js                 # starts listening
│   │   ├── routes/{auth,users,properties,viewings,favourites,reports}.routes.js
│   │   ├── controllers/
│   │   ├── services/
│   │   ├── middleware/{auth,roles,validate,errorHandler,upload}.js
│   │   ├── db/{pool,queries}.js      # migration files NOT here
│   │   └── utils/
│   ├── tests/{auth,authorization,properties,viewings,reports}.test.js
│   ├── package.json
│   └── Dockerfile
├── database/
│   ├── migrations/0001_initial.sql
│   ├── migrations/0002_indexes.sql
│   └── seeds/demo.sql               # fake demo records, no production secrets
├── docs/
│   ├── requirements.md
│   ├── api.yaml                     # canonical OpenAPI 3.1 contract
│   ├── api/                          # supplementary examples/feature notes
│   ├── diagrams/{erd,architecture}.md
│   └── decisions/{0001-stack,0002-auth,0003-lifecycle}.md
├── .github/{workflows/ci.yml,pull_request_template.md}
├── compose.yaml
├── .env.example
├── .gitignore
└── README.md
```

`{...}` shorthand represents separate directories/files; don't literally create brace-named files. Keep an actual file inventory before editing.

## 5. Database contract (PROPOSED)

All IDs: PostgreSQL `BIGINT GENERATED ALWAYS AS IDENTITY` or UUID **pick one globally**; this baseline proposes UUID generated by PostgreSQL `gen_random_uuid()`. All timestamps `TIMESTAMPTZ` stored UTC, rendered in **Asia/Thimphu** timezone in UI. Money: `NUMERIC(12,2)` in BTN (Ngultrum), never floating-point. `created_at`, `updated_at` where applicable. Foreign keys indexed. Implement CHECK/NOT NULL/UNIQUE constraints as well as API validation. Migration owner M3 coordinates with M4; M4 can add migrations for owned modules after schema agreement.

### Tables and columns

**`users`**
- `id UUID PRIMARY KEY`, `name VARCHAR(120) NOT NULL`, `email VARCHAR(254) NOT NULL` (normalized lowercase, unique case-insensitively), `password_hash TEXT NOT NULL`, `role VARCHAR(12) NOT NULL CHECK IN ('seeker','landlord','admin')`, `account_status VARCHAR(12) NOT NULL DEFAULT 'active' CHECK IN ('active','suspended')`, `created_at`, `updated_at`.
- Public signup only `seeker` or `landlord`; admin created by vetted one-off provisioning script, not a public endpoint. Do not store plaintext passwords or include hashes in API responses.

**`properties`**
- `id UUID PK`, `owner_id UUID NOT NULL REFERENCES users(id)`, `title VARCHAR(160) NOT NULL`, `description TEXT NOT NULL`, `monthly_rent NUMERIC(12,2) NOT NULL CHECK >= 0`, `deposit NUMERIC(12,2) NOT NULL CHECK >= 0`, `bedrooms SMALLINT NOT NULL CHECK BETWEEN 0 AND 20`, `neighbourhood VARCHAR(100) NOT NULL`, `landmarks TEXT NULL`, `water_available BOOLEAN NOT NULL DEFAULT false`, `parking_available BOOLEAN NOT NULL DEFAULT false`, `move_in_date DATE NOT NULL`, `availability_status VARCHAR(16) NOT NULL DEFAULT 'available' CHECK IN ('available','rented')`, `visibility_status VARCHAR(16) NOT NULL DEFAULT 'published' CHECK IN ('draft','published','hidden','archived')`, `confirmed_at TIMESTAMPTZ NULL`, `expires_at TIMESTAMPTZ NULL`, `created_at`, `updated_at`.
- **Why separate statuses:** rented vs available is different from admin-hidden or archived; don't conflate them in one status column. Active public listing means published, available, nonexpired, and owner active.
- Ownership immutable after create. Soft-delete by `archived`, not row deletion, to preserve viewing/report references.

**`property_images`**
- `id UUID PK`, `property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE`, `storage_key TEXT NOT NULL UNIQUE`, `mime_type VARCHAR(32) NOT NULL`, `display_order SMALLINT NOT NULL DEFAULT 0`, `created_at`; validate type/size via upload handler. **PROPOSED:** max 8 images/property, max 5 MiB/file, JPEG/PNG/WebP only; inspect real content signature, not just extension or client MIME. Do not expose arbitrary filesystem paths.

**`viewing_requests`** (M4)
- `id UUID PK`, `property_id UUID FK`, `seeker_id UUID FK`, `proposed_at TIMESTAMPTZ NOT NULL`, `message VARCHAR(1000) NULL`, `status VARCHAR(16) CHECK IN ('pending','accepted','rejected','cancelled') DEFAULT 'pending'`, `created_at`, `updated_at`. Future requested time and only publicly available properties. Define cancellation rules below.

**`viewing_status_history`** (M4)
- `id UUID PK`, `viewing_id UUID FK`, `old_status VARCHAR(16) NULL`, `new_status VARCHAR(16) NOT NULL`, `changed_by UUID FK users(id)`, `changed_at TIMESTAMPTZ NOT NULL DEFAULT now()`. Write request status change and history record in one DB transaction; never rely on frontend history.

**`favourites`** (M4)
- `user_id UUID FK`, `property_id UUID FK`, `created_at`, `PRIMARY KEY (user_id, property_id)`. Only seekers may create/remove; unique pair prevents duplicates.

**`listing_reports`** (M4)
- `id UUID PK`, `property_id UUID FK`, `reporter_id UUID FK`, `reason VARCHAR(1000) NOT NULL`, `review_status VARCHAR(16) CHECK IN ('pending','dismissed','actioned') DEFAULT 'pending'`, `reviewed_by UUID NULL REFERENCES users(id)`, `review_reason TEXT NULL`, `reviewed_at TIMESTAMPTZ NULL`, `created_at`. On action, admin may hide listing; preserve decision and audit fields.

**`session` table**: created by chosen PostgreSQL session-store adapter; migrate/setup consistently; never manually expose session records. Sessions must not grant suspended users ongoing access.

### Schema and query rules

- Use parameterized SQL (`pool.query('... WHERE id=$1', [id])`) only; no user input interpolated into SQL. For sorting, map accepted sort names to hardcoded SQL expressions.
- Use prepared DB transactions where a lifecycle action writes to multiple tables.
- Index `properties(visibility_status, availability_status, expires_at)`, `(neighbourhood)`, `(monthly_rent)`, `(bedrooms)`, `(owner_id)`; `viewing_requests(property_id, status)` and `(seeker_id, created_at)`, `property_images(property_id, display_order)`; uniqueness as defined. Verify indexes with realistic EXPLAIN later.
- Normalization: separate users, listings, images, requests/history, favourites and reports. Do not duplicate landlord email/name within each property.
- Test migration on an empty DB and after rerunning the migration command; migrations should execute **once** and never silently rewrite applied migrations.
- Seed only fictitious users/listings; seeded admin password injected from local secret (never committed).

## 6. Authentication, sessions, validation, and security (PROPOSED; high-priority team sign-off)

**Selected proposed approach: server-side sessions + HttpOnly cookie**. Do NOT implement JWT simultaneously. `express-session` stores opaque session identifiers, PostgreSQL stores session state; use `Secure` cookies in HTTPS production, `HttpOnly`, `SameSite=Lax`, a deliberately chosen cookie name, and appropriate reverse-proxy `trust proxy`. Authenticate using `req.session.userId`, but on **every protected request** load current `users.role` and `account_status` from DB; if suspended, reject and destroy session. Regenerate session on login to prevent fixation. Logout destroys session and clears cookie. Rate-limit login/register; use generic login errors to reduce enumeration. Apply CSRF protection to state-changing cookie-authenticated requests (CSRF token or verified same-origin Origin/Referer strategy); same-site cookie is not sufficient by itself. Never set `Access-Control-Allow-Origin: *` with credentials. Use Angular dev proxy for same-origin API access. Do not store session tokens in localStorage.

- Password: bcrypt with configurable reasonable work factor (default proposed 12), minimum length 12 and maximum 72 UTF-8 bytes for bcrypt input; consider switching to Argon2id if team supports it. Email case normalization and uniqueness. No password in logs; secrets supplied via env.
- Input validation: reject unknown fields on privileged mutations; normalize email; trim nonsecret strings; protect against mass assignment. Use safe structured error responses. Server owns authorization and invariants; never trust `owner_id`, `role`, `account_status`, `reviewed_by` from an unprivileged client.
- Security middleware: `helmet`, body-size limits, upload limits, abuse rate limits, production-safe errors, secure session storage, no stack traces to users. Audit account suspension and moderation. If implementing password reset or email verification later, design separately; neither is a first-release requirement in the source.
- UUID path params must be validated; wrong format is 400, not a SQL exception. Access-control rules apply even for direct URL access. Avoid exposing unpublished listings to unrelated seekers.

### Standard error envelope (PROPOSED)

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Invalid request", "details": [{ "field": "email", "message": "Invalid email" }] } }
```

Common codes: 400 `VALIDATION_ERROR`, 401 `UNAUTHENTICATED`, 403 `FORBIDDEN`, 404 `NOT_FOUND`, 409 `CONFLICT`, 413 `FILE_TOO_LARGE`, 415 `UNSUPPORTED_MEDIA_TYPE`, 429 `RATE_LIMITED`, 500 `INTERNAL_ERROR`. Do not expose raw SQL errors or whether another user's private resource exists.

## 7. REST API contract v1 (PROPOSED — copy into `docs/api.yaml` after approval)

**Base path:** `/api/v1` · JSON with UTF-8 unless multipart · UUID identifiers · ISO-8601 instants with timezone · money as decimal **strings** (`"12500.00"`) to preserve precision. All nonpublic mutations require cookie authentication, CSRF protection, active account, and permitted role. Frontend requests `withCredentials: true` where needed. For owner-only resource access, use consistent 404 for nonexistent/not-owned if hiding existence; 403 for known prohibited role action. Never return `password_hash`.

### 7.1 Auth + current account (M3 API; M2 UI)

| Method | Path | Access | Request | Success | Errors |
|---|---|---|---|---|---|
| POST | `/auth/register` | Public | `{name,email,password,role}` role `seeker\|landlord` | 201 `{user}` (no automatic login **PROPOSED**) | 400,409,429 |
| POST | `/auth/login` | Public | `{email,password}` | 200 `{user}` + session cookie | 400,401,403 suspended,429 |
| POST | `/auth/logout` | Signed in | empty | 204; destroy session/cookie | 401 |
| GET | `/auth/me` | Signed in | none | 200 `{user}` | 401,403 |

`user`: `{id,name,email,role,accountStatus,createdAt}`. Register must explicitly reject `admin`, `accountStatus`, `id`, or other forbidden fields. Registration always starts as `active`; any user-status change only through admin API.

### 7.2 Public properties + landlord listing management (M3 API; M1/M2 UI)

| Method | Path | Access | Request and semantics | Success | Errors |
|---|---|---|---|---|---|
| GET | `/properties` | Public | query below; returns publicly visible and nonexpired **available** listings only | 200 `{data,pagination}` | 400 |
| GET | `/properties/:id` | Public | only publicly visible listing; owners/admins use management routes for hidden/draft | 200 `{property}` | 400,404 |
| GET | `/my/properties` | Landlord | own listings, all statuses; page/limit | 200 `{data,pagination}` | 401,403 |
| GET | `/my/properties/:id` | Landlord owner | own listing details | 200 `{property}` | 401,403,404 |
| POST | `/properties` | Landlord | listing payload below; owner taken from session | 201 `{property}` | 400,401,403 |
| PATCH | `/properties/:id` | Landlord owner | permitted editable listing fields only | 200 `{property}` | 400,401,403,404,409 |
| DELETE | `/properties/:id` | Landlord owner | soft archive; no physical deletion | 204 | 401,403,404 |
| PATCH | `/properties/:id/availability` | Landlord owner | `{availabilityStatus:"available"\|"rented"}` with policy checks | 200 `{property}` | 400,403,404,409 |

**Proposed create body:**

```json
{
  "title": "Two-bedroom apartment near Clock Tower",
  "description": "Sunny apartment with water supply and parking.",
  "monthlyRent": "18000.00", "deposit": "18000.00", "bedrooms": 2,
  "neighbourhood": "Changzamtog", "landmarks": "Near main road",
  "waterAvailable": true, "parkingAvailable": true,
  "moveInDate": "2026-11-01"
}
```

Validation: title 5–160, description 20–5000, neighbourhood 2–100, landmarks ≤500, rent/deposit decimal ≥0 up to 12-digit database precision, bedrooms integer 0–20, booleans required, valid ISO date, `moveInDate` must not be arbitrarily rejected for older persisted records; rule for new posts should be agreed (proposed today or later). All fields except `landmarks` required on create. PATCH accepts nonempty subset of mutable fields only. Never accept `ownerId`, `visibilityStatus`, `confirmedAt`, `expiresAt`, `createdAt`, or `id` through ordinary edit. A property starts published/available **PROPOSED** (consider draft workflow if team wants it). Owner can edit own listing, not another's; even admin listing modification uses distinct audited moderation endpoint.

**Proposed property response**: `{id,ownerId,title,description,monthlyRent,deposit,bedrooms,neighbourhood,landmarks,waterAvailable,parkingAvailable,moveInDate,availabilityStatus,visibilityStatus,confirmedAt,expiresAt,images:[{id,url,displayOrder}],createdAt,updatedAt}`. Public response must omit owner email/private contact; `ownerId` exposure may be omitted for privacy if frontend doesn't need it.

**Search query:** `minRent`, `maxRent` decimal, `bedrooms` nonnegative integer, `neighbourhood` case-insensitive substring, `waterAvailable`, `parkingAvailable` booleans, `availableFrom` ISO date (properties with `move_in_date <= availableFrom`), `sort=recent|rent_asc|rent_desc`, `page` integer ≥1 default 1, `limit` integer 1–50 default 12. Combine filters using AND; enforce `minRent <= maxRent`; allowlist sort SQL; stable secondary ordering by ID. Use database pagination and separate total count for all filters. Return:

```json
{
  "data": [{"id":"<uuid>","title":"...","monthlyRent":"18000.00","images":[]}],
  "pagination": {"page":1,"limit":12,"total":42,"totalPages":4}
}
```

### 7.3 Property photos (M3; frontend landlord forms M2)

| Method | Path | Access | Request | Success | Errors |
|---|---|---|---|---|---|
| POST | `/properties/:id/images` | Landlord owner | `multipart/form-data` key `images`, up to 8 total images/property | 201 `{images:[...]}` | 400,403,404,413,415 |
| DELETE | `/properties/:id/images/:imageId` | Landlord owner | none | 204 | 403,404 |
| PATCH | `/properties/:id/images/order` | Landlord owner | `{imageIds:["<uuid>",...]}` exact owned image set | 200 `{images:[...]}` | 400,403,404 |
| GET | `/property-images/:imageId` | Public if attached listing publicly visible; owner access policy for unpublished | none | bytes correct Content-Type | 404 |

Store randomized server-controlled keys in durable volume, never original client path; generate filenames independently. Check actual magic bytes for JPEG/PNG/WebP, limit 5 MiB per file, strip dangerous metadata if practical, safe rendering headers, cap image count via transaction/locking to avoid race, delete orphan files on failed DB transactions and safely reconcile missing files. Files must survive container restarts. No SVG or executable upload.

### 7.4 Viewing requests and history (M4 API; M1/M2 UI)

| Method | Path | Access | Request | Success | Errors |
|---|---|---|---|---|---|
| POST | `/viewings` | Seeker | `{propertyId,proposedAt,message?}` proposedAt valid future ISO instant | 201 `{viewing}` | 400,403,404,409 |
| GET | `/viewings/mine` | Seeker | page/limit; own only | 200 `{data,pagination}` | 401,403 |
| GET | `/viewings/received` | Landlord | page/limit; requests for properties owned by user only | 200 `{data,pagination}` | 401,403 |
| GET | `/viewings/:id` | Seeker requester OR owning landlord | none | 200 `{viewing,history}` | 403,404 |
| PATCH | `/viewings/:id/status` | Owning landlord | `{status:"accepted"\|"rejected"}` from `pending` only | 200 `{viewing}` | 400,403,404,409 |
| POST | `/viewings/:id/cancel` | Seeker requester | pending/accepted → cancelled (proposed) | 200 `{viewing}` | 403,404,409 |

Reject requests for rented, expired, unpublished, hidden, archived, or owner-suspended properties; seeker cannot request own listing. A landlord can only decide on requests for their own property. Prohibit invalid transitions; status history is appended in same transaction. When property becomes rented, block **new** requests immediately; retain previous requests/history (existing pending requests may be cancelled by a policy decision; proposal: leave visible pending and let landlord resolve).

### 7.5 Favourites (M4 API; M1 UI)

| Method | Path | Access | Request | Success | Errors |
|---|---|---|---|---|---|
| GET | `/favourites` | Seeker | page/limit | 200 `{data,pagination}` | 401,403 |
| POST | `/favourites` | Seeker | `{propertyId}` publicly visible property | 201 `{favourite}` or 200 existing (idempotent proposal) | 400,404 |
| DELETE | `/favourites/:propertyId` | Seeker owner of favourite | none | 204 (idempotent) | 401,403 |

Unique composite key enforces no duplicates. Saved unavailable properties may remain in private favourites but must visibly display unavailable status (PROPOSED).

### 7.6 Reporting and moderation (M4 API; M2 UI)

| Method | Path | Access | Request | Success | Errors |
|---|---|---|---|---|---|
| POST | `/reports` | Active signed-in user | `{propertyId,reason}` length 10–1000 | 201 `{report}` | 400,404,409 |
| GET | `/admin/reports` | Admin | `reviewStatus`, page/limit | 200 `{data,pagination}` | 403 |
| PATCH | `/admin/reports/:id` | Admin | `{reviewStatus:"dismissed"\|"actioned",reviewReason}` | 200 `{report}` | 400,403,404,409 |
| PATCH | `/admin/properties/:id/visibility` | Admin | `{visibilityStatus:"hidden"\|"published",reason}` | 200 `{property}` | 400,403,404 |

Record review actor/time and decision reason. Hidden listings are not public. Avoid deleting evidence/report rows on moderation.

### 7.7 Admin user management (M3 API; M2 UI)

| Method | Path | Access | Request | Success | Errors |
|---|---|---|---|---|---|
| GET | `/admin/users` | Admin | `role`, `accountStatus`, page/limit | 200 `{data,pagination}` | 403 |
| PATCH | `/admin/users/:id/status` | Admin | `{accountStatus:"active"\|"suspended",reason}` | 200 `{user}` | 400,403,404,409 |

Require reason 10–1000 for suspension/reactivation audit (**PROPOSED** add `account_status_history` migration if approved; without this, at minimum durable server-side audit). Admin cannot suspend their own currently logged-in admin identity; never allow public role escalation. Reject protected actions by suspended users immediately, including existing sessions. Decide whether public listings owned by suspended landlords are hidden: **proposed yes**, via effective public filter.

### 7.8 Listing freshness / renewal (M4 lead + M3 DB integration)

| Method | Path | Access | Request | Success | Errors |
|---|---|---|---|---|---|
| POST | `/properties/:id/confirm` | Landlord owner | empty | 200 `{property}` | 403,404,409 |
| GET | `/my/properties/expiring` | Landlord | page/limit | 200 `{data,pagination}` | 403 |

**PROPOSED** confirmation sets `confirmed_at=now()`, `expires_at=now()+30 days`. Public queries use `expires_at > now()`; if null on legacy/demo records, choose explicit fallback. Rent/hidden/archive does not become visible solely through confirmation. Background cleanup/reminder worker is optional; expiration itself must be enforced by SQL query immediately, without needing a cron run. Any reminder job requires an owner and deployment plan. Source draft's earlier 14-day example was explicitly *not approved*.

### 7.9 Comparison and move-in-cost estimate (B20 optional)

Implement client-side selection of 2–3 property objects from public GET/details endpoints; do not create an unnecessary persistence table or endpoint. Compare rent, deposit, bedrooms, facilities, neighbourhood, move-in date. Basic estimated upfront cost = first month's rent + deposit. Label this an estimate; exclude utilities, agency fees, and moving costs unless user enters them. Make no claim the displayed estimate is a quoted landlord price.

### API authorization matrix

| Action | Guest | Seeker | Landlord | Admin |
|---|---:|---:|---:|---:|
| Browse public properties/details | ✓ | ✓ | ✓ | ✓ |
| Register/login | ✓ | ✓ | ✓ | ✓ (login only; no admin signup) |
| Save favourites/request viewing | — | ✓ | — | — |
| Publish/edit own property/photos | — | — | ✓ own | — (moderation separate) |
| Respond to own listing's viewings | — | — | ✓ own | — |
| Report listing | — | ✓ | ✓ | ✓ |
| Review reports/manage user status | — | — | — | ✓ |

## 8. Angular frontend delivery specification (PROPOSED)

- **Routes/views:** `/`, `/properties`, `/properties/:id`, `/login`, `/register`, `/my-properties`, `/my-properties/new`, `/my-properties/:id/edit`, `/my-viewings`, `/landlord/viewings`, `/favourites`, `/admin/reports`, `/admin/users`, `/compare` (optional), `/**` Not Found. Guard protected routes by role for UX; API independently enforces rules.
- **Components:** navbar/role-specific links, property card/list, property detail/gallery, price/availability badge, filter panel, pagination, registration/login forms, listing editor with photo preview + upload progress, landlord requests table/action dialogs, seeker viewing form/list, favourites control, admin queue/user controls, error/empty/loading states.
- **Data layer:** typed DTO interfaces matching §7, Angular services (`AuthService`, `PropertyService`, `ViewingService`, `FavouriteService`, `AdminService`), HttpInterceptor for standard error handling and CSRF header if token-based mechanism chosen; `withCredentials` as required. Avoid frontend hardcoded endpoint shapes that conflict with OpenAPI.
- **Forms and UX:** Angular Reactive Forms with required/min/max/email constraints mirrored server-side, accessible labels, keyboard navigation, responsive mobile-first layout, disabled submit while pending, useful field errors, confirmation dialogs for destructive actions. Do not render user-supplied descriptions as raw HTML. Show currency BTN/Nu., dates Asia/Thimphu.
- **Filtering:** reflect filter state in URL query params; reset page on filter change; debounce free-text input; link list → detail → viewing; handle exhausted/out-of-range pages and no results.
- **Sessions:** load `/auth/me` at app initialization, hide inappropriate menus/redirect on 401/403, never infer security from route guards, logout calls backend. Avoid keeping sensitive auth state in localStorage.
- **Photos:** preview selected allowed types and indicate size/count limits; after server upload, refresh canonical server image list. Client checks are convenience only; server validates again.
- **Accessibility:** visible focus, semantic form controls, validation summaries, image alt text (`title` + order), contrast and functional narrow/mobile layout. Decide formal target (proposed WCAG 2.1 AA as aspiration; not yet verified).
- **Tests:** service HTTP mocks, guards, form validators, listing/search states, role-specific navigation, at least one user journey integration/end-to-end check if time allows.

## 9. Nonfunctional acceptance and security checklist (PROPOSED)

**Reliability:** DB/photo data persist after container restart; migrations are repeatable; app health endpoint `GET /api/v1/health` returns `200 {"status":"ok"}` when API is serving (separate readiness DB check `/api/v1/ready` optional). No user passwords, secrets or unnecessary PII in logs.

**Validation:** all input fields validated server-side, unknown privileged fields rejected, consistent pagination, upload content inspection, safe error envelope.

**Security:** strong password hashing, login rate limiting, secure cookies, session rotation, CSRF defense, backend role/ownership enforcement, no SQL injection, admin provisioning out-of-band, status changes take effect immediately, no unsafe CORS wildcard credentials.

**Performance:** indexed public property listing with pagination; avoid N+1 image fetches. Numerical latency/concurrency target **not approved**; measure during demonstration rather than inventing a benchmark.

**Persistence:** PG data named volume and uploads named volume; test restart and recovery. Define backup/restore method before claiming production resilience.

**Privacy:** public endpoint must not expose emails, hashes, session data, unreviewed reports, or seeker viewing messages. Audit log and user data retention needs team policy before production use.

## 10. Backend test plan (first implement B03/B04)

| Test | Expected result |
|---|---|
| Register valid seeker and landlord | 201; hashed password, valid role, no hash in response |
| Register with `role:"admin"` or injected `accountStatus` | 400/403; no admin/suspended-account creation |
| Duplicate email / invalid email / short password | 409 / 400; no duplicate row |
| Login correct / wrong password | 200 session / 401 generic error |
| Login rotates session ID | Previous session ID cannot be used as logged-in session |
| Logout | Session invalidated; protected route returns 401 |
| Unauthenticated property create | 401 |
| Seeker attempting property create | 403 |
| Landlord A edits/removes landlord B's property | 403 or 404 (consistently chosen), no mutation |
| Owner edits own property | 200, persisted |
| Suspended user accesses any protected action with prior session | 403 and invalidated session |
| Public search with multiple filters, pagination, invalid sort | Combined AND, accurate count; 400 bad input |
| Hidden/rented/expired listing search | Excluded |
| SQL injection-style filter text | Treated as data, never executable SQL |
| Invalid media type/oversize file/foreign property upload | 415/413/403, no persisted asset |
| Viewer not owning a viewing sees history | 403/404; no data leak |
| Landlord changes unrelated viewing request | Rejected, state/history unchanged |
| Report action as non-admin | 403 |
| Duplicate favourite | One row only |
| Restart DB and image containers | Data and photos still available |

Test DB must be isolated from real development and production data. Use real PostgreSQL for auth/session, constraints and ownership integration tests; mock only external boundaries. Add relevant Angular tests. Never describe tests as passing unless actually run.

## 11. Configuration / environment contract (PROPOSED)

`/.env.example` and `backend/.env.example` may share a documented single source of truth; avoid contradictory copies. Proposed variables (examples are *not* secrets):

| Variable | Purpose | Example / sensitivity |
|---|---|---|
| `NODE_ENV` | Backend environment | `development` |
| `PORT` | Express listen port | `3000` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://homefinder:change_me@localhost:5432/homefinder` **secret in real use** |
| `SESSION_SECRET` | Strong random secret | `replace_with_long_random_secret` **secret** |
| `SESSION_COOKIE_NAME` | Cookie name | `homefinder.sid` |
| `SESSION_TTL_HOURS` | Session lifetime | `24` |
| `BCRYPT_COST` | Work factor | `12` |
| `UPLOAD_DIR` | Persistent uploaded files directory | `/app/uploads` |
| `MAX_UPLOAD_MB` | Maximum file size | `5` |
| `MAX_PROPERTY_IMAGES` | Images per property | `8` |
| `APP_ORIGIN` | Trusted same-origin CSRF check | `http://localhost:4200` |
| `FRONTEND_API_BASE` | Angular build/runtime API path, **public** | `/api/v1` |
| `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` | Compose DB bootstrap | `homefinder`, `homefinder`, `replace_me` |

In Docker, `DATABASE_URL` typically uses hostname `db`, not `localhost`. Do not ship real passwords, session secrets or production credentials in templates, Git history or frontend environment files. Backend startup must fail clearly if mandatory secrets are missing in non-test environments. Note that `FRONTEND_API_BASE` consumed by a compiled Angular bundle is public; no secrets there.

### Setup targets (not verified commands)

Agree exact npm scripts and document them after implementation: `npm ci`, `npm run dev`, `npm test`, `npm run build`, `npm run lint` in relevant directories; `npm run db:migrate` as backend wrapper invoking root migration scripts; `docker compose up --build` for integrated stack. Since no repository scripts were inspected, these are *expected script names*, not claims they currently work.

## 12. Docker, CI/CD and deployment (M5 coordinating)

- Compose services: `db` (PostgreSQL with named volume), `api` (Express, health check, mounted upload volume), `web` (build Angular and serve via Nginx proxy or agreed alternative), optionally `migrate` one-shot job executed before API starts. DB health check before migration/API; no schema mutation during concurrent app startup.
- Local browser origin should proxy `/api/v1` and media routes without blanket CORS. In local Angular development, configure `proxy.conf.json` to API port, preserving cookies. In deployment, terminate HTTPS, configure `Secure` session cookie, reverse proxy/trusted proxy, and container restart policies.
- PR GitHub Actions: install pinned dependencies with lockfiles → lint → unit tests → integration tests against temporary PostgreSQL service → frontend/backend builds → optional image build. Main branch protected against merging failed checks. Do not commit `.env`, `uploads/`, `node_modules/`, `dist/`, logs, or real DB backups.
- Delivery: build images from merged main; supply secrets via deployment environment/secret store; run migrations once; start stack; smoke-test register/login, landlord listing/photo, search, seeker viewing, landlord response, moderation. Record deployment URL only after actual deployment.
- Evidence: screenshot PR checks, container status, database restart persistence, end-to-end demonstrations, schema/ERD and commit/PR history. Don't fabricate CI passes.

## 13. Suggested build sequence for deadline pressure

| Stage | Deliverable | Dependency and owner |
|---|---|---|
| 0 | Team approves proposed contract and records deviations | All |
| 1 | Express app factory + DB migration + users/session; auth & access tests, register/login/logout/me | M3 + M2 |
| 2 | Angular auth screens integrated; CI runs tests | M2 + M5 |
| 3 | Properties create/edit/archive, ownership, listing queries/details/filter/page | M3 + M1/M2 |
| 4 | Photo uploads + persistent volume; landlord form/gallery | M3/M2/M5 |
| 5 | Viewings with history, requester/owner permissions | M4 + M1/M2 |
| 6 | Status rented and new-viewing rejection; favourites, reports, suspend users | M3/M4 + UI |
| 7 | Freshness/renewal; optional comparison only if Musts stable | M4/M1 |
| 8 | Full regression, Docker restart, deployment, report and team rehearsal | All; M5 coordinates |

Parallel streams are encouraged **only after API and shared migration conventions are agreed**. No agent should generate all features in a single unreviewable PR; use bounded slices and maintain a working main branch.

## 14. Acceptance journeys for the final demonstration

1. Seeker registers (cannot select admin), logs in and searches by rent + bedrooms + neighbourhood with pagination.
2. Landlord logs in, publishes a listing and uploads valid photos; seeker opens its detail page and sees cost/facilities/photos.
3. Different landlord attempts to edit/delete the listing and is denied.
4. Seeker requests a future viewing; owning landlord accepts/rejects; each party sees correct status/history; other accounts cannot read it.
5. Landlord marks property rented; it disappears from public availability searches and new viewing requests are rejected.
6. A user reports a misleading listing; admin reviews/hides it; a suspended account cannot use protected actions even with an older session.
7. Restart app/database containers; property data and photo files remain. Show PR checks, deployment and test evidence.

## 15. Required documentation produced from this specification

- `README.md`: project overview, prerequisites, **verified** setup/start/test/migration instructions and troubleshooting.
- `AGENTS.md`: rules from §0, ownership from §3, source-of-truth hierarchy, security rules and requirement to report verification truthfully.
- `docs/requirements.md`: §1 scope plus explicit functional/nonfunctional acceptance criteria.
- `docs/api.yaml`: an **actual valid OpenAPI 3.1** file defining every approved endpoint, request/response schema, auth cookie scheme, error and pagination schema, multipart uploads; the Markdown tables here are *not* a substitute for machine-valid OpenAPI.
- `docs/diagrams/erd.md` and `architecture.md`: current entity/relationship diagram and component/data flow.
- `docs/decisions/`: ADR for technology/runtime, session vs token, schema IDs/statuses, image storage/limits, status transition/expiry, admin provisioning, error format, CI/deployment.
- `.env.example`: safe placeholders; `.gitignore`: ignore secret/build/upload artifacts.
- `.github/pull_request_template.md`: linked backlog item, scope, migration/API changes, test evidence, screenshots and reviewers.

## 16. Unapproved defaults the team must explicitly resolve

| Decision | Proposed baseline used in this document | Status |
|---|---|---|
| Language/runtime | Node LTS, backend JavaScript ESM, Angular TypeScript | PROPOSED |
| Auth | Server-side PostgreSQL sessions, HttpOnly cookies, CSRF defenses | PROPOSED |
| Identifiers/time/money | UUID, UTC timestamps / Asia-Thimphu display, BTN decimal strings | PROPOSED |
| API naming | `/api/v1`, camelCase JSON, envelope/errors in §7 | PROPOSED |
| Public registration | Seeker/landlord only; admin via private provisioning | Security requirement + proposed mechanics |
| Admin/self suspend/audit | No self-suspend; durable status audit | PROPOSED |
| Property visibility | published + available + nonexpired + active owner | PROPOSED |
| Listing deletion | Soft archive | PROPOSED |
| Property freshness | 30 days from owner confirmation | PROPOSED; earlier draft explicitly undecided |
| Uploads | JPG/PNG/WebP; 5 MiB; 8 images; persistent local volume | PROPOSED |
| Viewing rules | Future time; pending→accepted/rejected/cancelled | PROPOSED |
| Favourites | Unique pair; unavailable saved items remain visible privately | PROPOSED |
| Comparison | Optional frontend-only 2–3 properties | PROPOSED |
| CI gate | At least 1 review + passing automated checks | PROPOSED |
| Hosting/dates/people | To be supplied by team, never fabricate | OPEN |

After the team approves a decision, create a dated ADR identifying approvers and alternatives considered; amend this specification and OpenAPI together. **Do not write “approved” merely because an agent generated the proposal.**

## 17. Assessment requirements from source draft

The supplied draft says the mini-project starts Week 8 and the report is due in Week 14 (exact date not supplied); report marking: introduction 2, case formation 3, content/findings/discussion 5, conclusion 3, references 2 (15 total). Presentation: technique/language/confidence 0.5, clarity/coherence 1.5, facts/statistics/details 1, slide design 0.5, Q&A responses 1.5 (5 total). **All five members present; 15 minutes total including questions.** Confirm the official assessment sheet before final submission. Preserve screenshots/logs of actual implementation and avoid unverified claims.

---

### Ready-to-paste prompt for another coding agent

> Work in the `house-rental-app` repository using `Thimphu_HomeFinder_Implementation_Spec.md` as the **proposed baseline**, not proof of team approval. First inspect `AGENTS.md`, `README.md`, `docs/requirements.md`, `docs/api.yaml`, `docs/decisions/`, package files, and current source. Report differences between approved contracts and proposals. Respect feature ownership. Start with backend auth and its security/ownership tests, then migrations and property APIs, without implementing M4's viewings/favourites/reports. Use Angular/Express/PostgreSQL, parameterized SQL, strict validation, access-control checks, and documented migrations. Implement one reviewable slice at a time, update contracts and environment examples, run actual tests, and state precisely what was verified. Never claim a feature is deployed or approved unless there is evidence.
