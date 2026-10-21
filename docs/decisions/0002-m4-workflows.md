# M4 implementation proposal — 2026-10-20

Status: implemented on a review branch using the specification's proposed baseline.
This document is not evidence of team approval. M3/M1/M2/M5 should review before merge.

The existing M3 session middleware, role checks, response errors, PostgreSQL pool,
transaction helper, property lock and migration runner remain the shared foundation.
Migrations append after 0004; existing migration checksums remain unchanged.

## Viewing lifecycle

Creation is seeker-only for a currently public property. The property and owner
rows are locked while checking availability to serialize against renting, hiding,
archiving or suspending its owner. UTC instants must be in the future.
Only the owning landlord may accept/reject pending requests; only the requesting
seeker may cancel pending or accepted requests. Terminal transitions return 409.
The request and history update commit atomically. Initial history has oldStatus null.
No automatic cancellations occur when listings become rented, hidden or expired:
the existing private request/history remains accessible to its two parties.
There is no specified duplicate/overlap policy, so separate requests remain allowed;
acceptance is a viewing arrangement, not a reservation of the property.

## Favourites, reports and moderation

Favourites are idempotent per seeker/property. Existing saves remain listed when
a property becomes unavailable, with property null and available false so private
listing details are not exposed. Removal remains possible.

Reports accept only currently public properties. One pending report per
reporter/property returns 409 on duplication; another is possible after review.
Reviews are terminal (pending to dismissed/actioned). Reviewing a report does not
change property visibility implicitly: the specified visibility endpoint performs
that separate, audited action. Archived listings cannot be republished by moderation.
Unhiding preserves availability/expiry and therefore cannot reopen rented/expired homes.

## Freshness — proposed, requires team review

Confirmation extends expiresAt to 30 days from now and records confirmedAt. It
preserves visibility/availability; archived listings cannot be renewed.
The expiring page includes non-archived listings with no expiry or expiry within
7 days, including expired listings. The 7-day reminder window is a UI convenience.
Existing null expiries keep M3's approved public behaviour until first confirmation;
there is no retroactive expiry migration or background worker. Queries enforce
non-null expiry immediately. Applying freshness to all newly created listings
would change M3 property creation and remains a coordination dependency.

DTOs and these endpoint details are recorded in docs/api.yaml. They need frontend
and backend review together before merge; no alternative auth or endpoints are added.
