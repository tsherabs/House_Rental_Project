# M1 — B07/B08 property browsing and details

This feature branch introduces the repository's first Angular application. The repository previously contained only the planning README. No AGENTS.md, approved API file, architecture decisions, frontend, or backend existed when inspected.

The supplied Thimphu_HomeFinder_Implementation_Spec.md was read as the proposed baseline. This implementation does not mark its choices as team-approved. It is a reviewable draft pending M3 contract confirmation and M2 review of the minimal router/application shell. Angular 22 was scaffolded using CLI 22.2.3; installed dependencies are captured in frontend/package-lock.json. No existing Angular version was replaced.

## Delivered slice

- Public `/properties` list and `/properties/:id` detail routes; `/` redirects to browsing and unknown paths show Not Found.
- Reactive filters: neighbourhood (350 ms debounce), min/max rent, bedrooms, water, parking, move-in-by date; recent/rent ascending/rent descending sorts.
- Query-string filter persistence, page reset when applying filters, server pagination, and redirection to the last page after results shrink.
- Reusable property cards, responsive grid and gallery, plain-text descriptions, facilities, rent/deposit, BTN currency and Bhutan date display.
- Loading, empty, API error/retry and unavailable-property states; accessible labels, focus styling, skip link and semantic controls.
- Typed read-only HTTP service; real API requests only. Test fixtures are confined to automated tests.

## Integration contract to confirm with M3

Specification §7.2 defines the proposed contract used here:

1. `GET /api/v1/properties`: query `minRent,maxRent,bedrooms,neighbourhood,waterAvailable,parkingAvailable,availableFrom,sort,page,limit`; response `{data: Property[], pagination: {page,limit,total,totalPages}}`.
2. `GET /api/v1/properties/:id`: response `{property: Property}`. Decimal money fields remain strings. Image fields are `{id,url,displayOrder}`. Property field names and nullability are in `frontend/src/app/features/properties/property.ts`.
3. Public list rows must contain card fields (title, neighbourhood, bedrooms, monthlyRent, facility flags, availabilityStatus, images). The specification's abbreviated list example is not a complete list DTO; M3 must confirm the final list schema before merge.
4. The API enforces visibility, expiry and landlord status. Client filtering is not an authorization boundary.
5. Image URLs must resolve through the deployed same-origin proxy or an agreed public media origin. No storage keys or disk paths are consumed by the frontend.

The injectable `PROPERTY_API_BASE` defaults to `/api/v1`. Development `/api` requests proxy to `http://localhost:3000`; M3/M5 must confirm that port. No backend endpoints, migrations or canonical approved OpenAPI were invented. Publish the agreed schemas to `docs/api.yaml` with M3 before merging dependent integration work.

## Team dependencies and next slices

- **M2:** review the initial app shell/routing; integrate shared navigation/auth without creating a competing authentication system. No login or registration UI is included in this slice.
- **M3:** implement/confirm the two read endpoints, list DTO, media URLs, pagination, decimal strings and public visibility semantics; run against persisted PostgreSQL records.
- **M4:** confirm viewing/favourite DTOs, session/CSRF approach and lifecycle rules before the next seeker viewing/history/favourites slice. No protected mutations are included here.
- **M5:** review shared bootstrap/version choice and deployment proxy/static fallback to index.html for SPA routes. Verify setup on a second teammate's computer.

Comparison/cost estimation remains optional and has not been prioritized over Must features. Viewing requests/history and favourites remain outstanding; this is the requested first incremental browsing/details slice, not a complete seeker frontend.

## Suggested pull request

## Verification on 20 October 2026

- `npm run build`: passed with strict TypeScript and Angular template checking.
- `npm test -- --watch=false`: 3 test files, 10 tests passed. The initial sandbox run failed on a generated temporary-file lookup; the complete rerun outside the sandbox passed.
- `git diff --check`: passed before staging.
- No live API, PostgreSQL, deployed environment, browser visual audit, or multi-machine setup was available/verified. No lint script is configured.
- Branch: `feature/B07-B08-seeker-properties`. GitHub CLI is not installed and no GitHub connector is connected; no pull request has been submitted. The text below is ready for a PR once remote access is available.

## Pull request text

Title: `B07/B08: add M1 seeker property browsing and details`

Creates the initial Angular frontend and a public seeker browsing/details slice using the specification's proposed property read contracts. Adds URL filters, pagination, cards, photos/facilities, failure states and HTTP/router tests. Requires M3 contract confirmation and M2 shell review before merge. No backend or authentication implementation is included.

Backlog: B07/B08. No issue number or teammate identity was supplied. PR submission requires an authenticated GitHub CLI/connector or manual push/open; do not fabricate a PR URL or approval.
