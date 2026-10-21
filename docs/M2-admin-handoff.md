# M2 administrator accounts — B14

Stacked on `codex/m2-landlord`. `/admin` and `/admin/users` use the shared administrator role guard. The dashboard links only to implemented functionality.

Implemented: paginated users, URL-persisted role/status filters, status editor, trimmed mandatory 10–1000-character reason, confirmation before suspension/reactivation, current-account protection, refresh after mutation, and loading/empty/error states. Uses approved `GET /admin/users` and `PATCH /admin/users/:id/status` without changing their bodies or responses. User creation/promotion and audit persistence remain server responsibilities.

M4 reports/moderation remains blocked: `docs/api.yaml` intentionally excludes it and `backend/src/app.js` mounts no report or visibility-moderation routes. The specification's proposed report endpoints do not define a complete report response DTO. Implement report queue/review/visibility screens after M4 publishes the approved schemas and API. No duplicate backend or guessed report shape is included here.

Tests verify exact query/body fields, self-protection, audit reason/confirmation, URL filter reset and rejected transitions. See `docs/M2-handoff.md` for final verification and integration limitations.
