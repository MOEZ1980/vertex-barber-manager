# VERTEX HAMMAMI — Royal Gold Staging Integration

This is a visual integration preview built using the original `vertex-barber-manager` backup and graphics extracted from Royal Gold V4.

## What changed
- Added a Royal Gold hero and Moez profile to the existing agenda.
- Added a separate CSS overlay to preserve the existing application layout and DOM identifiers.
- All existing `vertex-apex.js`, `vertex-sw.js`, Supabase endpoints and logic remain byte-for-byte unchanged.
- Existing Blocks, Clients, Barbers, notifications, and login are retained.

## What has not changed
- No live deployment and no database change.
- No automatic WhatsApp API integration.
- This is not yet an exact pixel-perfect V4 UI reproduction; it is a first safe visual layer.

## Safe release
1. Create a new branch of the **existing** `vertex-barber-manager` repo, e.g. `royal-gold-preview`.
2. Upload the files from this bundle to that branch, rather than `main`.
3. Preview on an isolated environment, check login, bookings, blocks and push before merging.
4. Do not replace the live `index.html` with the standalone V4 demo, because it uses simulated data.

Note: When moving to a new domain, browser push subscriptions and service workers may require re-registration.
