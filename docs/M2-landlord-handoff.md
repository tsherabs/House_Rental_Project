# M2 landlord slice — B05/B06/B12

Stacked on the authentication slice (`codex/m2-auth`). No backend or API contract changes. Uses the approved M3 OpenAPI and reuses M1's `Property` and `PropertyImage` interfaces.

Delivered: paginated owner dashboard; property creation/editing through management reads; strict mutable-field payloads; decimal-string money; valid calendar dates including persisted past dates; facility fields; availability toggles with confirmation; archive confirmation; hidden/archived-state messaging; JPEG/PNG/WebP selection and previews; 5 MiB/8-image client checks; XHR upload progress; image removal and order controls. All photo mutations reload the canonical management detail image list. Browser checks are convenience only; backend validation/ownership remains mandatory.

Paths: `/my-properties`, `/my-properties/new`, `/my-properties/:id/edit`, landlord guard only. Owner-only editing uses `/my/properties/:id`, not the public endpoint. Archived records cannot be changed. Availability changes never send visibility fields or restore moderation-hidden listings. New listings are saved before photos are uploaded, so an upload failure does not cause duplicate property creation.

M4 viewing acceptance/rejection cannot be integrated yet: no approved viewing DTO/endpoint appears in `docs/api.yaml`, and the backend has no viewing routes. No speculative viewing screen or alternate API is added. M4 must supply request, property/seeker display fields, status/history schemas and integration tests.

No `.env.example` or OpenAPI edits were needed: the backend's existing configuration and contracts are consumed unchanged. M3/M5 should verify media persistence, configured upload limits, and same-origin proxying. See final `docs/M2-handoff.md` for actual verification evidence.
