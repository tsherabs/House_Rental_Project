# Platform usability and deployment additions

Status: implemented for review at the user's request. This records the changes; it does not claim team approval or a production launch.

The existing Angular, Express, PostgreSQL, cookie session, CSRF and API conventions remain in place. Migration 0007 appends notifications and shared request-limit counters. Existing migrations are unchanged.

## Notifications

Authenticated active accounts can retrieve only their own notifications through GET /api/v1/notifications, with page, limit and unreadOnly parameters. PATCH /api/v1/notifications/:id/read accepts an empty object and marks an owned notification read idempotently. Responses follow the existing camelCase and pagination conventions. Unrelated identifiers return 404.

Viewing creation notifies the landlord; acceptance/rejection notifies the seeker; cancellation notifies the landlord. Report review notifies the reporter, and visibility moderation notifies the owner. Notifications commit in the same transaction as their event, so failures roll back both. Messages contain no private administrator reasons or contact data. They link to the relevant workflow page. No email, push delivery, polling, retroactive events or administrator broadcast is implied. Retention policy remains a launch decision.

## Comparison and budget planning

Up to three public property IDs are saved in browser local storage. No credentials or cached property details are stored. The comparison page retrieves current public details on entry and on Refresh, and handles unavailable listings. Clearing browser storage clears the selection; shared-browser users see the same selection. Move-in estimates use integer minor units and are never submitted to the server. Deposits and rent remain decimal strings in the existing contract; no payments or extra mandatory fees are introduced.

## Operations

PostgreSQL replaces the process-local authentication limiter described in ADR 0001. Limits are shared across replicas: 30 authentication attempts per 15-minute IP window; 30 viewing submissions and 10 reports per hourly account window. Invalid attempts count. Fixed windows permit a boundary burst. Counters use HMAC identifiers, expire automatically on subsequent limited requests, and return 429 with Retry-After. Protect public traffic with an upstream firewall/WAF as appropriate; these limits are not DDoS protection.

GET /api/v1/health remains liveness; GET /api/v1/ready requires the current migration marker. Request correlation IDs and structured timing logs omit bodies, query strings, cookies and IPs. Docker Compose supplies PostgreSQL, a one-shot migration service, a non-root API and a Caddy static frontend/reverse proxy, with durable database/uploads/TLS volumes. Local preview binds loopback. Public deployment requires a domain and HTTPS configuration. The API port is never published; only the controlled proxy is trusted inside the Compose private network. Do not attach untrusted containers to that network.

The workflow adds automated API validation, backend integration tests, Angular tests/build and container builds. It performs no deployment. M5 must select hosting, pin/review base images and action versions, configure backups/monitoring and complete the deployment checklist. ADR 0002 renewal decisions still require team review; this change does not alter them.
