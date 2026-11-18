# VERTEX Barber Manager

New independent project for the VERTEX HAMMAMI shop. No source code, styles, scripts, or filenames are copied from the old admin project.

## Current milestone

Build a fresh, mobile-first admin app under a separate source tree. The first connected release signs in through existing Supabase Auth, reads bookings through the existing admin endpoint, and handles appointment status, edits, and time blocks through the existing schedule endpoint. Do not put internal conversation or development notes in the app interface.

## Product direction

- Italian interface; black and gold VERTEX style; mobile and desktop layouts.
- Admin sign-in and booking management connect to the existing Supabase service using its publishable browser key and authenticated session.
- Monthly calendar with appointment time and customer name shown in date cells; selecting a date jumps to its appointments.
- Month-wide appointment list grouped by date; selecting a date jumps to its group.
- Booking status filters and counts; inspect, confirm, reject, cancel, and edit.
- Block and unblock periods; searchable client list; barber management.
- New unique browser session key, separate from the old admin.

## Rollout

1. Review the new interface and source files.
2. Create a separate GitHub repository named `vertex-barber-manager` under the current GitHub account.
3. Upload the new files and publish to a temporary GitHub Pages URL.
4. Verify sign-in, bookings, status actions, editing, and time blocks against the existing service. Do not change the public booking flow or notifications.
5. Only after verification, point `admin.vertexhammami.it` to the new project. Keep the old repository intact for rollback.

The first release serves one shop. Multi-shop accounts, tenant isolation, subscription billing, and commercial onboarding come later.
