# Version 2.0.3 — Quiet owner access

6 November 2026

Removed sign-in buttons from public pages and moved owner login to the unlinked `/pages/owner.html` page with a noindex directive. Existing HttpOnly sessions remember the owner for the configured session lifetime (seven days by default). IP addresses do not bypass authentication.

Marked authoring controls hidden in the original HTML and added a CSS guard until authenticated initialization completes. Visitors do not see add/edit actions, the music input/loading controls, novel uploads, backups, trash, or sign-out controls. Published music metadata and listening links remain visible. Owner controls reappear with a valid session and disappear again after an expired-session response. Reader and backup templates also apply the owner visibility rules when opened.

Verified 28 frontend/static scenarios, 13 embedded PostgreSQL/API scenarios, and 7 mocked music scenarios. Checks cover default-hidden public authoring controls, the absence of public sign-in links, remembered-owner visibility, expiry, and the separate owner page's failed/successful sign-in flow. These frontend tests use DOM stubs, not a rendered browser. Updated setup instructions for the new owner entry point.
