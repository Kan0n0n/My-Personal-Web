# PostgreSQL application reference

Version 3 frontend/HTTP update, 17 November 2026: React sources live in `frontend/`, Vite builds `dist/`, and Express dispatches the existing API endpoints. Data-service modules and SQL contracts below remain in use. Raw uploads retain bounded readers; development uses the same origin as the API. See [development and operations](DEVELOPMENT.md) and [migration verification](versions/2026-11-17-react-migration.md) for current commands and tests. Historical frontend file references below are superseded.

Version 2.0.0 · 6 November 2026. This supersedes the browser-storage contracts in the version-1 code reference/report. The [database design](DATABASE-DESIGN.md) remains the model rationale; the SQL migration and this document describe implemented behaviour.

## Modules

| Module | Responsibility |
| --- | --- |
| `server/db.mjs` | PostgreSQL pool, date-only parser, single-client transactions, ordered checksummed migrations |
| `server/migrations/001_initial.sql` | Eleven domain tables, import receipts, constraints, indexes |
| `server/model.mjs` | Trusted table/column descriptors, field validation, explicit response encoding, legacy-backup validation |
| `server/auth.mjs` | Scrypt password hashes, opaque session tokens with stored SHA-256 digests, expiry/revocation, login limiter |
| `server/store.mjs` | Owner-scoped lists/CRUD, profile updates, publication/trash actions, private text/progress, consistent export |
| `server/import.mjs` | Owner/file/source-bound signed preview, transaction and receipt-based initialization |
| `server/api.mjs` | HTTP JSON API, origin validation, body limits, safe error responses, music lookup |
| `scripts/serve.mjs` | Configuration/startup and allowlisted static file handler; no credentials in browser files |
| `scripts/migrate.mjs`, `scripts/owner.mjs` | Administrative schema/owner lifecycle commands |
| `assets/js/picturebook.js` | API bootstrap, forms, lists, server acknowledgements, reader, legacy export |

SQL identifiers are chosen only from trusted descriptors. Values use positional parameters. Multi-statement work uses one checked-out client and a transaction. Records are encoded through explicit field maps; no raw database row is sent publicly. A date-only parser prevents host timezone conversion of PostgreSQL DATE values.

## HTTP contracts

All responses are JSON with `Cache-Control: no-store`. All writes require an exact matching `Origin: APP_ORIGIN` and JSON content type. No CORS access is enabled. Sessions use a same-origin HttpOnly, SameSite=Strict cookie; HTTPS origins also set Secure. No browser token/localStorage authentication is used.

| Method / path | Request / response |
| --- | --- |
| `POST /api/auth/login` | `{login,password}`; sets cookie; limited to 10 attempts per IP per 15 minutes per process |
| `GET /api/auth/session` | `{authenticated,login}` |
| `POST /api/auth/logout` | `{}`; revokes token and clears cookie |
| `GET /api/public/notebook` | Version-1 shaped notebook containing configured owner's music, public profile fields, and published notes/writings/anime; private arrays empty |
| `GET /api/me/notebook` | Complete active notebook metadata and bookmarks; no book text; consistent read transaction |
| `PUT /api/me/profile` | Complete profile fields plus `revision`; returns committed profile/new revision |
| `GET /api/me/records/:collection` | Active list; `limit` 1–500, nonnegative `offset`; `trash=true` selects deleted rows |
| `POST /api/me/records/:collection` | New record fields; server allocates UUID; returns 201 and committed record |
| `PUT /api/me/records/:collection/:id` | Complete editable record plus revision; returns committed record |
| `POST /api/me/records/:collection/:id/trash` | `{revision}`; recoverable deletion |
| `POST /api/me/records/:collection/:id/restore` | `{revision}`; returns restored record |
| `POST /api/me/records/:collection/:id/publish` | `{revision}`; only posts/blogs/anime |
| `POST /api/me/records/:collection/:id/unpublish` | `{revision}`; only posts/blogs/anime |
| `GET /api/me/books/:id/content` | `{text}`; checks parent ownership and nondeleted state |
| `PUT /api/me/books/:id/progress` | `{progress,font,theme,revision?}`; omit revision on first save; returns committed progress/revision |
| `GET /api/me/export` | `{notebook,books}`; consistent export of active records with text |
| `POST /api/me/import/preview` | `{source,backup}`; returns counts, message, signed token |
| `POST /api/me/import/commit` | `{backup,token}`; returns counts and `repeated`; initializes only pristine accounts |
| `GET /api/music-info?videoId=...` | YouTube oEmbed metadata; no database write; 11-character ID validation, 10-second upstream timeout |

Collection names are `posts`, `blogs`, `tasks`, `documents`, `anime`, `events`, and `books`. Existing form field names are retained in API responses; SQL fields are normalized. `blogs.category` uses `Blog`/`Story`, task and anime statuses use their existing display labels. Posts/blogs/anime include owner-only `publication_state` in authenticated responses. Publishing is an explicit action, not an editable record field. IDs, revisions, and publication metadata in returned records are accepted for round trips; writes never trust client IDs/owners/publication metadata as mutation instructions.

Profile fields: `name,bio,status,intro,watching,playing,doing,song,artist,musicCover,musicUrl,is_public,revision`. Reading fields: `progress,font,theme,revision`. Book creation fields: `title,sourcePath,format,text`; text is TXT/MD only, 10 MiB UTF-8 maximum. Existing book text cannot be overwritten through a record update; uploading another copy preserves the existing bookmark.

From 2.1.0, book metadata includes nullable `folderId` and formats `txt,md,pdf,epub`. Reading progress also accepts/returns `locator` (`pdf:PAGE` or `epub:SECTION:SCROLL_PERCENT`). Existing percent-only bookmarks remain supported. Metadata updates cannot change the original format.

From 2.1.2, EPUB pages use `epubpage:SPINE_SECTION:TEXT_OFFSET` locators. The reader maps legacy EPUB locators to nearby pages. Displayed page numbers are continuous, with up to 1,800 text characters per page and separate illustration pages; only table-of-contents titles label those pages. Font changes do not change these boundaries. No schema migration is needed.

From 2.1.3, 1,800 characters is a soft target: pages break at Unicode sentence boundaries, allowing a longer page for a single oversized sentence. Shelf Rename uses the existing revision-checked book metadata PUT endpoint; content and progress are preserved. Hover/focus cover previews fetch authenticated originals and extract EPUB cover metadata/cover-page art or render the first PDF page in the browser. Preview object URLs are bounded to a 20-book cache and cleared when owner access ends; no new schema or endpoint is required.

From 2.2.0, progress accepts/returns `fontFamily` (`georgia,overlock,palatino,arial,verdana,monospace`) and `anchor` (`offset`, normalized viewport `y`, scroll `ratio`). Migration `003_reading_preferences.sql` adds these columns; prior bookmarks default to Georgia with an empty anchor. The existing PUT endpoint handles both automatic and manual writes with revision checks. Client saves are serialized, delayed automatic writes are canceled by manual saves, and the latest confirmed save becomes the reopening position. Export/import includes the new preferences and anchors. Shelf renaming controls were removed; reader title/folder editing remains available. TTS is planned only.

From 2.3.0, migration `004_reader_speech_alignment.sql` adds `alignment` (`left,center,right,justify`) and `speech` preferences (`voiceURI`, rate 0.5–2, boolean `follow`). These use the existing progress API, revision checks, and backup/import flow. `reader-speech.mjs` provides local browser-voice playback, word/sentence range highlights, navigation cancellation, and spoken-position saves. PDF renderers expose selectable text spans and a controller `advance()` hook; manual/automatic page events identify their source. No speech service or new audio endpoint is used.

| Library endpoint | Behavior |
| --- | --- |
| `GET /api/me/folders` | Owner's series folders, including empty folders |
| `POST /api/me/folders` | Create with `{title}` |
| `PUT /api/me/folders/:id` | Rename with `{title,revision}` |
| `POST /api/me/folders/:id/remove` | Check revision, move all folder books to Unfiled, and remove folder transactionally |
| `POST /api/me/books/upload?title=...&format=pdf\|epub&sourcePath=...&folderId=...` | Raw bytes, matching `application/pdf` or `application/epub+zip`, up to 50 MiB |
| `GET /api/me/books/:id/file` | Authenticated original binary, no-store, attachment disposition, sandbox CSP |

All library endpoints enforce owner isolation. New migrations add `book_folders`, `books.folder_id`, nullable text plus exclusive binary storage in `book_contents`, and reading locators. `server/grants.sql` includes folder access. JSON export/import includes a `folders` envelope array and base64 originals while remaining compatible with prior text-only backups. See [library guide](NOVEL-LIBRARY.md) for supported EPUB features and backup size limits.

From 2.0.6, public notebook responses always include `song,artist,musicCover,musicUrl` for the configured owner. When `is_public=false`, these are the only profile fields returned. Profile revision and owner identity remain excluded; profile writes still require an authenticated owner.

From 2.0.4, empty optional profile text is displayed/edited using the page defaults rather than erasing visible copy. URLs remain empty when absent. The interests editor preserves unrelated profile fields and visibility. Weather uses transient browser coordinates or an explicitly selected geocoding search result; place choices last for the page visit and are not persisted in PostgreSQL. Provider calls occur only after user interaction.

From 2.3.1, JSON and binary uploads share bounded request-body reading, with byte limits enforced even without a trustworthy Content-Length. JSON requests require the exact `application/json` media type (case-insensitive, optional parameters allowed). Oversized bodies return HTTP 413 with "Request is too large." Queued manual bookmarks now reject if an earlier save blocks the reading session with HTTP 401 or 409. Malformed optional EPUB resource URLs are ignored while required missing chapters still fail validation.

Errors: 400 invalid input, 401 sign-in required/invalid login, 403 origin rejected, 404 unknown route/book, 409 stale or unavailable record/data conflict, 413 oversized request, 415 non-JSON body, 429 login limit, 503 unconfirmed database/upstream operation failure. On a record write, an unavailable ID and an ownership mismatch are deliberately indistinguishable. No SQL text or connection secrets are exposed in errors.

## Current limits and differences from the proposal

- Eleven domain tables plus `import_receipts` operational receipts and `schema_migrations`; no RLS policies. A restricted runtime role and explicit API owner predicates are required.
- Empty-account import only. No merge, destructive restore, silent overwrite, or automatic legacy cleanup.
- Legacy field names and freeform tags are preserved; no tag/category catalogue or chapters.
- Paginated collection routes support bounded access. For compatibility, the current UI loads all notebook metadata and filters it in memory. This is suitable for a personal notebook, not a large public catalogue; page-scoped server search remains future work.
- Slug is reserved in SQL for future permalinks but no slug editor/permalink route exists yet.
- No permanent-delete UI, scheduled trash purge, scheduled database backups, offline synchronization, or independent draft copy of a published record.
- The old `database()`/`booksOp()` helpers are limited to explicit legacy export. The app never saves notebook edits to localStorage or IndexedDB.
- Font/theme choices save when **Keep my place** is clicked, matching the manual bookmark flow. Percentage is approximate across viewport sizes.
- Profile name/required titles are limited to 500 characters; ordinary body/label fields to 1,000,000 characters; URL fields to 4096. Most JSON writes are limited to 2 MiB; book writes to 12 MiB; import envelopes to 64 MiB.

## Verification

As of 2.1.0, `npm test` runs 39 frontend/static scenarios, 15 database/API integration scenarios, 7 mocked music API scenarios, and 7 PDF/EPUB reader scenarios. The database suite uses the actual PostgreSQL engine through PGlite by default; `TEST_DATABASE_URL` selects a native dedicated test database (14 scenarios, excluding embedded role provisioning). Reader checks use a DOM environment and native PDF canvas rendering. Frontend VM element stubs verify state/requests but do not render layouts. Native database/deployment verification and real browser interaction remain separate checks.
