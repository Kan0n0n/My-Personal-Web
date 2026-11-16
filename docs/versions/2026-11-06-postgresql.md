# Version 2.0.0 — PostgreSQL notebook

6 November 2026

Replaced local browser authoring with a server-backed PostgreSQL API while retaining the site’s HTML/CSS layout. Browser stores are preserved and read only during an explicit legacy backup export.

## Changes

- Added eleven domain tables, import receipts, and checksummed transactional migration history. Added Node/npm setup, optional local Compose database, restricted-runtime grants, and separate administrative migration/owner commands.
- Added owner password login/recovery, Scrypt hashes, hashed opaque sessions, HttpOnly/SameSite cookies, origin checks, body limits, and per-process login limiting. No public registration.
- Added owner-scoped CRUD for every existing persisted feature, revision conflict checks, explicit draft/public publishing, private-only notebook sections, recoverable trash and restoration.
- Stored book text separately from shelf metadata, fetched it on demand, and saved reading percentage/font/theme through the API. Source files are unchanged; repeat uploads keep separate copies.
- Added legacy export of localStorage and IndexedDB, strict server preview, signed owner/file-bound commit, UUID mapping for bookmarks, transaction rollback, and committed-import receipts. Initialization requires an empty, unedited destination. Merge/destructive restore are not enabled.
- Restricted static serving to website files. Secrets, SQL/server source, packages, dependencies, and backups are not exposed by the file server.
- Updated frontend forms, sign-in/out, publishing, backup/import, trash, and save-failure behaviour. Added current setup and API references.

## Verification

- `npm test`: 24 frontend/static scenarios, 13 embedded PostgreSQL/API integration scenarios, 7 mocked YouTube API scenarios.
- Migration applied twice to verify repeatability. Database/API tests include authenticated and anonymous HTTP requests, cross-owner denial, database constraint failures, stale revisions, publication filtering, book text/digests/bookmarks, recovery from trash, safe exports, and logout.
- Injected a database trigger failure during import and verified that earlier rows and the profile update rolled back.
- Applied the runtime grants, switched to the restricted role, verified that schema/credential mutation was denied, and verified login/import/export still worked.
- JavaScript syntax checks and offline dependency audit passed.

## Remaining setup and limits

A persistent native PostgreSQL service and credentials must be configured before normal startup; none was running in this workspace. No native database deployment or existing-user data migration was performed. Automated tests use PGlite’s embedded PostgreSQL engine rather than a production fallback.

The browser automation host was unavailable, so actual browser sign-in, file pickers, layout, and end-to-end interactions still need review. No RLS policies, scheduled database backup jobs, permanent-deletion UI, large-library batched imports, independent draft edits of live publications, or offline synchronization are included. The current UI retains in-memory metadata filtering; paginated API lists support bounded access, but server-side full-text search is future work. Follow [setup](../DATABASE-SETUP.md) and [API reference](../API-REFERENCE.md) for exact operational limits.
