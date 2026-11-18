VERTEX BARBER MANAGER — SOURCE FILES

This is a new, independent app. It does not include copied source files from the old admin. Its UI is in Italian. Sign-in and appointment actions use the existing Supabase service; the app does not store the account password.

Files in this starter:
- index.html — GitHub Pages entry page
- vertex-apex.css — visual design and responsive layout
- vertex-apex.js — sign-in, calendar, booking list, status changes, editing, time blocks, client actions, and Push enrollment/testing
- vertex-sw.js — receives browser Push notifications and opens this new admin site when tapped
- logo.jpg — VERTEX HAMMAMI brand logo used by the app and Push notifications
- PROJECT.md — scope and safe rollout order

The existing public website and old admin remain unchanged. Publish to a temporary GitHub Pages URL first, then verify the Supabase connection before changing the admin domain.
