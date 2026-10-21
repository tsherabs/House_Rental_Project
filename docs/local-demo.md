# Run and test the local demo

This is a local development preview, not a deployed service. The demo homes are
fictional and their AI-generated photos are labelled as illustrative. All role
flows use real PostgreSQL data and the existing HttpOnly session authentication.

## This computer

Open **http://127.0.0.1:4200/properties**. Use that exact host so cookies and the
configured `APP_ORIGIN` agree. The API is on port 3000, proxied through Angular.
The isolated PostgreSQL instance uses port 55433 with data under ignored
`.local/pgdata`. Database and session secrets live only in the ignored root `.env`.

If the services have stopped, run from the repository root in PowerShell:

```powershell
./scripts/start-local.ps1
```

This reuses the initialized project database and running ports, then checks the
proxied API health endpoint. It does not install software, recreate the database,
reset accounts or change Windows services. Logs for processes it starts are under
`.local/`. The PostgreSQL path can be set with `-PostgresBin`.

Demo accounts are `seeker@homefinder.test`, `landlord@homefinder.test` and
`admin@homefinder.test`. Their local password was supplied in the delivery message;
it is not committed. You may also register your own seeker or landlord account.

## Fresh setup on another computer

1. Install Node 24 and PostgreSQL. Create separate empty development and test
   databases; the test database name must end in `_test`.
2. Copy `.env.example` to `.env`, set database URLs, a generated session secret and
   `APP_ORIGIN=http://127.0.0.1:4200`. Keep real secrets out of Git.
3. In `backend`, run `npm ci`, then `npm run db:migrate`.
4. Optional demo data: set `DEMO_SEED=1` and `DEMO_PASSWORD` to a password accepted
   by registration (12–72 UTF-8 bytes), then run `npm run demo:seed`. This command
   refuses production/nonlocal databases, preserves existing accounts/listings,
   and does not reset existing demo passwords. Remove the password from the shell
   environment afterwards. A partial failed seed may need manual inspection;
   do not use the seed to repair production data.
5. Provision an admin with M3's `npm run admin:create`, supplying `ADMIN_NAME`,
   `ADMIN_EMAIL` and `ADMIN_PASSWORD` privately. Public registration cannot make admins.
6. Start `npm start` in `backend`. In another terminal, run `npm ci` and
   `npm start -- --host 127.0.0.1 --port 4200` in `frontend`.

For this machine, the isolated cluster was initialized with PostgreSQL 17, SCRAM
authentication and a generated password. No existing PostgreSQL service was changed.

## Try the workflows

- Seeker: browse/filter, open a home, save it, request a future Bhutan-time viewing,
  follow its history under **My viewings**, and report a listing.
- Landlord: open **My viewings**, accept/reject pending requests; use **My properties**
  to edit photos/details or mark a listing rented. **Confirm expiring listings**
  shows expired, unconfirmed and next-seven-days listings. Fresh demo listings are
  confirmed for 30 days, so that page initially has an empty state.
- Administrator: open **Administration → Listing reports**, enter a reason and
  review or change visibility. Reviewing a report and hiding a home are separate
  operations. **User accounts** uses M3's existing suspend/reactivate workflow.
- Sign out before switching roles. The browser smoke test leaves an accepted
  Olakha viewing and a reviewed Taba report so you can inspect their state. You can
  create another report after review to test the pending queue yourself.

## Verified check commands

```powershell
# backend (loads only the explicit isolated test DB from root .env)
node --env-file=../.env node_modules/vitest/vitest.mjs run
npm run lint
npm run check:api

# frontend
npm test -- --watch=false
npm run build
npx --no-install prettier --check src
```

Tests use generated PostgreSQL schemas and remove only their own test data.
Do not point TEST_DATABASE_URL at the development database.
The whole-tree formatting command currently reports existing shared-file formatting
issues. The files changed for M4 were formatted and checked separately.
