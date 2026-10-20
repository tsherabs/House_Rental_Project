# M3 Express API

Use Node 24 LTS. Dependencies are locked in package-lock.json. Backend scripts
load the root `.env`; `.env.example` is the single configuration template.

```sh
cp .env.example .env # from repository root; fill in database and generated secret
cd backend
npm ci
npm run db:migrate
npm run dev
```

Create the PostgreSQL database/user separately. Run migrations before starting
API workers; they do not run as a side effect of app startup. The migration
runner locks against concurrent execution, records checksums, runs each file
in a transaction and rejects changed/missing applied files. Add new numbered
files under `database/migrations/` instead of editing applied migrations.

The Angular development proxy forwards `/api` to port 3000. Browser mutations
must originate from `APP_ORIGIN`; API clients must supply that Origin header
(or a same-origin Referer). This includes registration and login. No CORS
wildcard, JWT or browser localStorage token is used. Login rotates the cookie,
logout destroys it, and the database role/status is checked for each protected
request. Registration does not log in automatically.

Configure HTTPS APP_ORIGIN, NODE_ENV=production and exact trusted proxy
addresses/CIDRs for deployments terminating TLS at a reverse proxy. Secure
cookies require Express to recognize HTTPS. Default proxy trust is disabled.
Login/register rate limits are per-process; multi-replica deployment needs
M5 to configure a shared store. Keep the upload directory on durable storage.

## Database tests

Use a dedicated database with a name ending in `_test` and a role allowed to
create schemas. Tests create a random schema and remove only that schema.
They reject a missing URL or a URL identical to DATABASE_URL. Do not point
these tests at any production database.

```sh
export TEST_DATABASE_URL=postgresql://homefinder_test:local_password@localhost:5432/homefinder_test
npm run test:auth
npm test
npm run lint
npm run check:api
```

Test fixtures may use low bcrypt cost; runtime configuration requires at least
10, default 12. Tests use PostgreSQL for users, sessions and constraints, plus
Supertest for actual HTTP middleware behavior. See `docs/M3-handoff.md` for
executed results and integration gaps when delivery is complete.

## Administrator provisioning

No public request can create or promote an admin. With authorized database
access, set ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD and run `npm run admin:create`.
Supply passwords using environment/secrets tooling, not command arguments or
committed files. Existing accounts are never promoted by this command. Remove
ADMIN_PASSWORD afterward.

## Photo storage and recovery

Images are private files with random server-generated names; public URLs point
to the visibility-checked `/api/v1/property-images/:imageId` handler. Files are
decoded and re-encoded to remove metadata. The API accepts JPEG, PNG and WebP,
at most 5 MiB/file and 8 images/property, with a 25-megapixel decoding limit
and no animations. Environment limits may lower the defaults.

Database and filesystem writes cannot share an atomic transaction. Upload
failure removes written files; image removal commits the database deletion
before deleting the file. A process crash or failed unlink can leave an orphan,
which the API cannot serve. `npm run uploads:check` reports orphan keys and
missing image IDs without deleting anything. Pause writes while reconciling;
restore missing files from backup or remove their image records through the
owner API, and review orphans before filesystem removal. Missing bytes return
a safe 404. M5 must verify volume persistence and backups.

## M4 integration

Import `authentication(pool, config)` and `roles(...)` for protected routes;
`req.user` is a safe current-account DTO. Use `transaction(pool, work)` for
multi-table mutations. The exported `PUBLIC_PROPERTY` predicate uses fixed
aliases `p` and `u`; rental request transactions must lock and recheck the
property so an availability change cannot race a new viewing. Use the same
property lock ordering when adding related writes.

M3 does not assign expiry or confirm listings. Null `expires_at` means not yet
assigned; non-null expired rows are excluded immediately. M4 should review that
convention before enabling freshness. Existing hidden or archived visibility
is never undone by availability changes.

Add migrations starting after `0004_account_status_history.sql`, coordinating
numbers before merge. Never recreate users, properties or session tables.
Viewings/favourites/reports tables and business endpoints remain M4-owned.
