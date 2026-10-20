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
static directory. M5 still needs to supply deployment proxy/container/volume
configuration and test durable data across container restarts.
