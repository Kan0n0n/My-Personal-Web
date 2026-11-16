# Version 2.3.1 — Code review and focused refactoring

What this repo does: A personal website with published notes and anime logs, plus an authenticated notebook and novel library backed by PostgreSQL. This review assumes one owner, occasional visitors, and a single Node.js server process.

## Findings and changes

1. **Manual bookmarks could appear successful after a failed automatic save.**
   In `assets/js/reading-position.mjs`, a manual save queued behind an automatic save returned silently if the automatic save then failed with HTTP 401 or 409. The bookmark action could announce success without writing the manual position. Queued manual saves now reject with the existing reload instruction once the session is blocked. Automatic retries remain stopped after authorization or revision conflicts; transient failures remain retryable.

2. **A malformed image URL could prevent an EPUB from opening.**
   `archivePath` in `assets/js/novel-formats.mjs` could throw on invalid URL syntax or percent encoding during chapter sanitization. It now returns null for malformed paths, matching its handling of external resources. The sanitizer drops the invalid image and preserves readable text and valid local illustrations. Missing required chapter paths still produce an error.

3. **Request-size checks were duplicated, and JSON media-type validation accepted invalid suffixes.**
   `server/api.mjs` now uses one `readBody` helper for JSON and raw book uploads. Both still reject bodies above their existing byte limits, including streamed bodies without a trustworthy Content-Length. JSON requests accept `application/json` with optional parameters and reject types such as `application/jsonp`. Oversized binary requests retain HTTP 413 and now use the shared message, "Request is too large."

No dependencies were added. No schema, stored data, page layout, or authentication contract changed. Package and lockfile versions are 2.3.1; the archive changelog links here.

## Scope and verification

Reviewed the README, package/deployment configuration, HTTP routing and static-file isolation, authentication, validation, ownership checks, database transactions and grants, backup/import flows, novel file handling, reader persistence, speech lifecycle, and their tests. Also inspected the browser request/edit flows, owner page, launcher, and retained extractor code. This was a focused source review, not an exhaustive audit of every historical document, stylesheet, or vendored dependency.

The new save-race and malformed-image tests were each run before their fix and failed on the original behavior. Both pass after the fixes.

`npm test` passed all 125 scenarios:

- 40 frontend/static scenarios.
- 14 request-body scenarios: byte limits, missing or understated Content-Length, UTF-8 bytes, malformed JSON, object-only bodies, and media types.
- 15 database/API integration scenarios using embedded PostgreSQL, including ownership, restricted grants, stale revisions, and transactional rollback.
- 7 mocked music API scenarios.
- 24 PDF/EPUB reader scenarios, including actual PDF rendering and malformed-image recovery.
- 10 reading-position/autosave scenarios, including pending automatic-save failures with HTTP 401 and 409.
- 15 read-aloud scenarios with mocked device voices.

## Retained limits and unchecked behavior

Follow-up launcher fix: Normal startup reproduced a missing-file error because a JavaScript string removed the Windows separators in the Docker Desktop path passed to PowerShell. The command now uses a raw string to preserve those separators. The opening guide explicitly shows normal startup without `--check`, which only validates configuration and exits. After the fix, normal startup was verified outside the sandbox: Docker Desktop started, the Compose database became healthy, and the launcher reported the app ready. The 40 frontend/static checks also passed after the documentation update.

- Backup restore retains its documented 60 MiB browser file limit, 64 MiB API envelope limit, and record-count limits. Binary encoding expands files: a 50 MiB original alone becomes roughly 66.7 MiB in JSON. Such exports require the documented administrator database-backup recovery path (`pg_dump` / `pg_restore`); do not rely on browser JSON restore for large libraries. See [library limits](../NOVEL-LIBRARY.md).
- Notebook metadata is loaded and filtered in memory, which matches the intended personal workload. No public-catalogue scaling changes or new abstractions were added.
- No live PostgreSQL instance, production deployment, real-browser layout, real device audio, Docker startup, or external extractor backend was exercised. Frontend DOM tests do not establish visual correctness.
- No Git metadata exists in this workspace, so Git status/diff verification was unavailable. No live notebook data was changed and no migration or deployment was performed.

Verdict: The reproduced save and EPUB failures are fixed, and the existing privacy and data-write checks still pass. Keep database backups for libraries beyond the browser restore limits.
