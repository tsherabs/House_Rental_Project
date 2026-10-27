# Running and operating HomeFinder

This release adds a container package and verification workflow. It is not a hosted production launch. Read the current decisions in `docs/decisions/` before merging; the 30-day renewal and initial null-expiry policy still needs team agreement.

## Local development and packaged preview

The existing seeded Angular/Express demo is at `http://127.0.0.1:4200/properties`; see `local-demo.md`. The Docker preview is separate, with its own database, accounts and uploads, at `http://127.0.0.1:8080`. Do not expect the development demo's credentials or listings in the container database.

Requirements: Docker with Compose v2, enough disk space for images and durable volumes, and outbound registry access for initial builds. Node 24 is required for running repository scripts outside containers.

1. Copy `deployment/.env.example` to `deployment/.env` and generate two different random hex values for POSTGRES_PASSWORD and SESSION_SECRET. Use at least 32 random bytes each. Never commit the file or paste secrets into logs. Hex avoids URL escaping issues in DATABASE_URL.
2. Run `docker compose --env-file deployment/.env -p homefinder-preview up -d --build` from the repository root.
3. Check `docker compose --env-file deployment/.env -p homefinder-preview ps` and `http://127.0.0.1:8080/api/v1/ready`. The migration service should exit successfully; database and API should be healthy.
4. Open `http://127.0.0.1:8080/properties`. Register separate test seeker and landlord accounts. The empty database contains no administrator and no demo data by default.
5. Optional isolated verification: `node scripts/smoke-containers.mjs`. This creates fictional accounts, one listing and a real uploaded illustrative image. It saves only test-session state in ignored `.local/container-smoke.json`. Never use this script against a public service; its destination is deliberately fixed to loopback port 8080.
6. After restarting API/web containers, run `node scripts/smoke-containers.mjs --verify-persistence` to verify sessions, data, notifications and media remain accessible.

Use `docker compose --env-file deployment/.env -p homefinder-preview stop` to stop without deleting data. Do not use `down -v` on a deployment you need to retain: it deletes named volumes.

## Public hosting configuration

Use a dedicated server and a production environment file. Set NODE_ENV=production, APP_ORIGIN=https://your.domain, CADDY_SITE=your.domain, BIND_HOST=0.0.0.0, HTTP_PORT=80 and HTTPS_PORT=443 together. Point the domain's DNS at the server and allow inbound TCP 80/443. Caddy terminates HTTPS and renews certificates; its data volume must persist. Do not use the HTTP development configuration publicly.

The frontend and API share one origin. Caddy sends `/api/*` requests to the internal API and serves Angular with SPA fallback. The API and database ports are not published. The API trusts the private proxy network, while Caddy overwrites untrusted incoming forwarding headers. Do not attach untrusted workloads to this network. If hosting behind a different proxy, review trusted proxy addresses and HTTPS forwarding before login testing. Never disable CSRF or Secure cookies to work around a proxy error.

The API runs as the non-root node user. Its upload volume is writable by that user. Database, uploaded files and Caddy TLS state use separate persistent volumes. This package supports a single API with local durable uploads; running multiple APIs also requires shared media storage, although sessions and request limits already use PostgreSQL.

Pin reviewed image digests and CI action revisions for your release, scan dependencies/images, and rehearse on a staging server before public launch. A localhost build does not verify DNS, public certificates, a hosting provider's firewall or production traffic capacity.

## Administrator provisioning

Provision an administrator privately using the existing `src/db/provision-admin.js`. Set ADMIN_NAME, ADMIN_EMAIL and ADMIN_PASSWORD in a secure operator environment, then run:

```text
docker compose --env-file deployment/.env -p homefinder-preview run --rm -e ADMIN_NAME -e ADMIN_EMAIL -e ADMIN_PASSWORD api node src/db/provision-admin.js
```

Do not put passwords directly in command arguments or version-controlled files. Remove ADMIN_PASSWORD from the operator environment afterwards. The command refuses to promote an existing account. Public signup only creates seekers or landlords.

## Backups and restoration

Back up the database and uploads together during a maintenance window with API/web stopped. Keep the database running. A consistent pair is necessary because uploaded files and their database metadata must match. Stop incoming traffic before an upgrade or backup; a graceful shutdown waits for current requests to finish.

The following commands target only the named local preview. Choose unique backup filenames and protect the backup directory. Do not overwrite an existing backup.

```powershell
New-Item -ItemType Directory -Force .local/backups | Out-Null
docker compose --env-file deployment/.env -p homefinder-preview stop web api
docker compose --env-file deployment/.env -p homefinder-preview exec -T db pg_dump -U homefinder -Fc -f /tmp/homefinder.dump homefinder
docker cp homefinder-preview-db-1:/tmp/homefinder.dump .local/backups/homefinder.dump
docker compose --env-file deployment/.env -p homefinder-preview run --rm --no-deps -v "${PWD}/.local/backups:/backup" api tar -czf /backup/uploads.tgz -C /app/backend/uploads .
docker compose --env-file deployment/.env -p homefinder-preview start api web
```

These commands use PowerShell and a local backup directory. Check every command's exit status before treating the pair as a successful backup; restart the app even if a backup command fails, then investigate. For production, use an operator-controlled backup job with failure handling and a dedicated destination. Copy backups to encrypted off-host storage, restrict access, choose retention, schedule backups and test restores regularly. Database dumps include personal data, password hashes and active session records.

Restore into a new, isolated database and a new upload volume first. Use `createdb`, then `pg_restore --exit-on-error -d NEW_DATABASE BACKUP_FILE`; never run a restore against the live database as an unreviewed test. Extract the paired uploads archive into the new volume, preserving the API user's ownership. Start the same application version and verify counts, login, photos and viewing history before planning a cutover. A backup is not proven until a restore succeeds. Back up TLS state and secret configuration through your secure infrastructure process as well.

For upgrades, take a consistent backup, build images, run the migration service successfully and check readiness before exposing traffic. Migrations are append-only and checksum-checked. Do not edit applied SQL files. The runner normalizes LF/CRLF line endings for new checksums and accepts legacy hashes of either representation without rewriting history; actual content changes still fail. Roll back code only when it remains compatible with the upgraded schema; otherwise restore a verified backup in a planned maintenance window.

## Health and observability

- `/api/v1/health` reports process liveness. `/api/v1/ready` requires database connectivity and migration 0007. A 503 readiness response means traffic should not be routed to that API.
- Each response has X-Request-ID. Request logs contain method, route pattern, status and duration, with no body, query string, cookie or raw IP. Use the request ID to correlate a support incident with server errors.
- Docker rotates container logs at 10 MiB per file, retaining three files. Configure central log collection, alerts for 5xx/503 errors, disk space, certificate failures and backup failures before launch.
- Authentication is limited to 30 attempts per IP per 15-minute fixed window. Viewing submissions are limited to 30 per account per hour, reports to 10. Invalid attempts count; 429 responses carry Retry-After seconds. Counters are shared across API replicas.
- Notifications are transactionally stored in PostgreSQL. They currently have no retention cleanup job. Choose a retention policy and capacity plan before a large rollout.

## Release checklist and ownership

- M3/M4: agree on renewal duration, initial expiry, duplicate/overlap handling and cancellation policy. Review notification privacy, migration 0007 and the 37-operation API contract.
- M1/M2: test seeker, landlord and administrator journeys on the staging origin, including keyboard/mobile use and error recovery. Replace fictional listings and illustrative property photos with authorized real content.
- M5: configure the domain, TLS, production secrets, private networking, persistent storage, migration ordering, backup/restore, monitoring, release rollback and CI branch protection.
- Product/operator: supply contact/support details, an appropriate privacy and terms process, data retention/deletion procedures, verified account recovery and a moderation/escalation policy. Self-service password reset, email verification and outbound notification delivery are not implemented.
- Run backend integration tests against a separate `_test` database, Angular tests/build, backend ESLint and OpenAPI validation. The GitHub workflow also builds both Docker images but does not deploy or approve a release.
- Rehearse a fresh-machine setup and an actual production HTTPS cookie/CSRF check. Confirm there are no demo credentials in the public environment. Do not treat local verification as team approval or a production readiness certification.
