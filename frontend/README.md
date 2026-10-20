# Thimphu HomeFinder — M1 frontend

Initial standalone Angular application for B07/B08 property browsing and details. See [M1 handoff](../docs/M1-handoff.md) for proposed contracts and team dependencies.

## Run locally

Use Node.js 24 LTS (checked with 24.21.0) and npm 11.

```powershell
cd frontend
npm ci
npm start
```

Open http://localhost:4200/properties. Development proxies /api to http://localhost:3000. Start M3's API separately when available. Without an API the interface displays an error and retry action. Production contains no mock listings.

## Checks

```powershell
npm test -- --watch=false
npm run build
```

Tests use Vitest, Angular Router and HTTP testing fixtures. They do not verify a live backend. Build output is dist/frontend/browser. No lint or browser end-to-end runner is configured yet.

## Integration

PROPERTY_API_BASE defaults to /api/v1. The development target is in proxy.conf.json. Production requires SPA route fallback and API/media proxying. The package-lock.json records installed dependencies.

M2 owns shared authentication/navigation; M3 owns property APIs/persistence; M4 owns viewing/favourite APIs; M5 reviews deployment/version choices. The current shell supports public browsing only. See the handoff before merging proposed API integration.
