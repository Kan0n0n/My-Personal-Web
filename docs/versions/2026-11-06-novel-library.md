# Version 2.1.0 — PDF, EPUB, and series folders

The private reading room now stores original PDF/EPUB files up to 50 MiB alongside existing TXT/MD books. Locally served PDF.js renders pages with navigation and zoom. EPUB ZIP parsing follows the package spine; DOMPurify restricts displayed chapters to basic formatting and archive-local raster illustrations. Unsupported/encrypted files show errors and remain downloadable after upload.

Owner-scoped series folders support creation, renaming, removal without deleting volumes, directory import grouping, and moving/renaming books. Composite foreign keys prevent cross-owner folder assignments. Revision checks protect folder and book updates. Book formats cannot be changed through metadata edits.

The additive schema migration preserves existing text and bookmarks. New bookmarks record PDF pages or EPUB sections/approximate scroll positions. Backups include folders and base64 originals; import remaps relationships into an empty notebook. Existing import size limits still apply, so large libraries need PostgreSQL backups. See [library guide](../NOVEL-LIBRARY.md).

Validation: existing frontend/API/music checks plus folder isolation, binary round trips, bookmark restoration, and backup restore checks pass. Seven reader scenarios use a DOM environment, actual PDF rendering, and an EPUB fixture with hostile markup to check sanitization and navigation. Real interactive browser/layout verification remains unavailable because the browser access host could not connect.

Final checks: 39 frontend/static, 15 database/API, 7 music, and 7 PDF/EPUB reader scenarios passed (68 total). Applied the migration to local PostgreSQL, verified the restricted runtime role can read the new schema, restarted the local app, and confirmed the reading page and local browser libraries respond successfully. Anonymous folder access returns 401.
