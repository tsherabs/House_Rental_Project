# Thimphu HomeFinder — Angular frontend

Initial standalone Angular application for B07/B08 property browsing and details. See [M1 handoff](../docs/M1-handoff.md) for proposed contracts and team dependencies.

M2 adds cookie-session authentication, landlord listings/photos and administrator account management using the approved M3 contract. See [M2 delivery and blockers](../docs/M2-handoff.md).

## Run locally

Use Node.js 24 LTS (checked with 24.21.0) and npm 11.

```powershell
cd frontend
npm ci
npm start
```

Open http://localhost:4200/properties. Development proxies /api to http://localhost:3000. Configure the root `.env` from `.env.example`, supply PostgreSQL and start M3's API using [backend setup](../backend/README.md). `APP_ORIGIN` must exactly match the browser origin, normally `http://localhost:4200`; `127.0.0.1` is a different origin. Without the API, public pages show an error and sign-in shows service-unavailable feedback. Production contains no mock data.

## Checks

```powershell
npm test -- --watch=false
npm run build
```

Tests use Vitest, Angular Router and HTTP testing fixtures. They do not verify a live backend. Build output is dist/frontend/browser. No lint or browser end-to-end runner is configured yet.

## Integration

`API_BASE` for M2 and existing `PROPERTY_API_BASE` for M1 both default to `/api/v1`. Override both together if deploying under another base. The development target is in proxy.conf.json. Production requires SPA route fallback and API/media proxying. The package-lock.json records installed dependencies. No frontend environment variables or secrets are required.

M2 routes: `/login`, `/register`, `/my-properties`, `/my-properties/new`, `/my-properties/:id/edit`, `/admin`, `/admin/users`. Registration does not log in. Admins are provisioned through M3's server script; public registration offers seeker and landlord only. Guards are UI conveniences; M3 enforces roles and ownership. Existing M1 browsing routes remain intact.

Photos are added after saving a property. JPEG/PNG/WebP previews, count/size checks, upload progress, ordering and removal use the owner APIs. The server performs authoritative image validation. Marking rented and archiving require confirmation.

M4 viewing decision and report moderation screens await approved contracts and implemented APIs. M1 owns seeker viewing/favourite screens; M5 owns deployment. Backend database/session persistence and a complete browser journey must still be verified in a configured integration environment.
