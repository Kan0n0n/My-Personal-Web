# Version 3.0.0 — React, Node.js and Tailwind

Implemented on the separate `test/react-node-tailwind` branch from baseline commit `423fb45`. The original branch remains available for rollback. The database schema, existing records, passwords, session format and service modules were retained; no data migration was required.

## Changes

- React now renders every page, shared layout, profile/calendar widgets, cards, forms and native dialogs. Existing `/pages/*.html` URLs and old root-page redirects remain supported. Page layouts and reusable markup are in `frontend/views.jsx` and `frontend/templates.jsx`.
- Tailwind is compiled with Vite using prefixed utilities and no Preflight reset. Original decorative CSS, fonts, artwork, responsive breakpoints, focus styles and reduced-motion behavior remain in use. The masthead is shared with the extractor.
- Existing API calls, confirmed saves and revision conflicts now drive React state. Failed edits keep their form data. Public music/private profile separation, publication actions, tasks, links, anime logs, reminders, archive, trash, browser-data export and signed backup imports remain available.
- The reading room retains the existing PDF/EPUB, speech and serialized save modules. React manages the shell, with dedicated renderer containers and effect cleanup for speech, timers, listeners, temporary URLs and reader instances. Fonts, alignment, spoken offsets and preferences persist through the existing API. Reopening the same book creates a fresh reading session.
- The extractor UI uses React for upload, results, JSON download and native-dialog zoom. Its existing graph builder has explicit destruction. Result URLs reject executable schemes. The original analysis service and external graph library remain separate dependencies.
- Express owns route dispatch for authentication, public data, notebook records, folders, originals, reading progress and imports. Existing validation, bounded body readers, CSRF checks, owner predicates, login throttling, private error handling, transactions and restricted database grants remain in use.
- Vite builds public pages into ignored `dist/`. Node serves this output and only explicitly exposed PDF support assets. Development uses Vite middleware and the API at one origin, with filesystem restrictions. The Windows launcher reports missing build output; run `npm run build` after source updates.
- Removed the replaced legacy page scripts and runtime HTML-template loading. The old reader HTML remains only as a test fixture. Reader-module tests remain alongside real React/browser tests.
- README is now a short app introduction and feature overview. Setup and operational material lives in [development and operations](../DEVELOPMENT.md) and the existing database/opening guides.

## Verification

- `npm test`: production build; React server-render checks for all page/layout exports, form defaults, escaped content and private control visibility; same-origin Vite and private-file isolation checks; 14 bounded-body, 15 embedded PostgreSQL/API, 7 music, 23 PDF/EPUB, 10 autosave and 15 mocked speech scenarios.
- `npm run test:browser`: seven Chromium scenarios using an isolated embedded database. They cover every page loading, phone overflow, owner login, failed-save draft retention, publication/trash/restore, TXT/EPUB/PDF upload and reading, fonts/alignment, spoken-position/preference saves, reopening the same book, profile privacy, music/weather mocks, task status, links, anime spoilers, JSON backup restore into an empty account, and extractor analysis/zoom with mocked external services.
- Home-page pixel comparisons against the committed pre-migration source at 390, 768 and 1366 CSS pixels passed the 2.5% changed-pixel threshold with a per-channel tolerance of 30. Screenshots were also recorded at 320 pixels; no page-wide home overflow was found. The desktop screenshot was visually inspected. This does not assert pixel identity for every state of every page.
- A private PostgreSQL snapshot was saved under the ignored `backups/` directory and successfully restored into a newly created temporary database. Only that temporary verification database was removed afterward. No live notebook records were edited for testing.
- The normal Windows boot launcher started the built app on a temporary port against the configured database; home HTML and the session API returned HTTP 200. Only that smoke-test launcher and child server were stopped.

## Remaining limits

Installed-device audio quality, Firefox/Safari, physical touch devices, 200% browser zoom and exhaustive reader visual comparisons remain unverified. Browser speech tests use a fixture voice; PDF rendering tests use real rendering. Live diagram analysis still requires the original service at `localhost:5000`; the mocked test does not establish model/backend availability.

The existing 60 MiB browser backup / 64 MiB import-envelope and record-count limits remain. Keep database backups for large libraries. An optional `.migration-baseline/` source archive enables historical screenshot comparison locally; it and private backups are ignored by Git and are not published.

Rollback: check out the preceding known-good commit, install that commit's locked dependencies and use its launcher. Since this release does not alter SQL/schema or convert notebook records, no database rollback is required for the framework change. Preserve independent database backups.
