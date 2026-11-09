# Current backend integration

```mermaid
flowchart LR
  A[Angular dev server] -->|same-origin /api proxy| E[Express app factory]
  E --> S[Session and CSRF middleware]
  S --> R[Routes and validation]
  R --> V[Services and ownership checks]
  V --> P[(PostgreSQL)]
  V --> F[Private upload directory]
  M[Explicit migration command] --> P
```

Only server.js starts listening. Tests create an app with an isolated PostgreSQL
schema. Image files are served through authorized API reads, never a public
static directory.Docker Compose now provides the Caddy reverse proxy, application services, database migrations and persistent volumes for PostgreSQL and uploaded images. Local container restart persistence has been verified. Public production hosting and off-site disaster recovery still require verification.

M4 viewing/community routers use the same session and role middleware. Viewing
decisions lock the request; new requests lock and recheck the property and owner.
History and moderation audit writes share the mutation transaction. Confirmation
updates the existing freshness columns; public queries enforce non-null expiry.
