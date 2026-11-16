# Development and operations

The application now uses React/Vite and Tailwind on the frontend and Express on Node.js. PostgreSQL and its existing schema are unchanged.

After installing dependencies, run `npm run build` once before normal startup. Repeat after source updates. `npm run dev` runs the Vite middleware and API on the configured APP_ORIGIN/port, preserving same-origin authentication. `npm start` serves the built app. The Windows launcher starts the built app and its database; `--check` only validates configuration.

Run `npm test` for build, React rendering, API/database, reader and speech checks. For Chromium checks, run `npx playwright install chromium` once and then `npm run test:browser`. These browser tests use an isolated embedded database and fixture owner, never the configured notebook. The optional original-source screenshot comparison uses a gitignored `.migration-baseline/` archive.

Frontend sources are in `frontend/`. Page entry URLs remain `/pages/*.html`. `frontend/views.jsx` holds the original page/layout markup; `templates.jsx` holds reusable fields and reader markup. Tailwind utilities use the `tw:` prefix without Preflight. Existing decorative CSS remains in `assets/css/`. `dist/` is generated and ignored by Git. Do not copy credentials, database exports or server files into it.

Do not change SQL migration files already applied to a notebook. To roll back this framework-only release, switch to the preceding commit, reinstall its locked dependencies and use its documented launcher. No data conversion or schema rollback is needed. Keep database backups for independent recovery.

The following retained operational reference describes existing database, publication and backup behavior. Its original test counts and frontend structure are historical.

## Existing operational reference

A personal anime website with a compact 2010-era layout, original artwork, and a private PostgreSQL notebook. Node.js serves the built React pages and an authenticated API.

## Set up and run

**Already set up?** Double-click **`Start Picture Book.cmd`** in this folder each time you want to use the app. It starts Docker Desktop and the local database when needed, starts the website, and opens your browser. Keep its window open while using the app; press **Ctrl+C** to stop the website. PostgreSQL stays running and keeps your data. You can make a desktop shortcut to this file. See [opening the app and viewing database tables](OPENING-THE-APP.md).

Use Node.js 22.13+ and PostgreSQL 15+ (UTF-8). Follow the [database setup guide](DATABASE-SETUP.md) to create the database, configure `.env`, apply restricted-role grants, and create the owner login.

```powershell
npm ci
Copy-Item .env.example .env
# Configure the connection URLs and signing secret; create the database.
npm run db:migrate
# Apply server/grants.sql as the database administrator.
npm run db:owner
npm run build
npm start
```

Open **http://127.0.0.1:4173/pages/index.html**. For editing, bookmark **http://127.0.0.1:4173/pages/owner.html** and sign in there. This page is unlinked from public navigation. The browser remembers the session for `SESSION_DAYS` (seven days by default); editing, music input, uploads, backups, and trash stay hidden from visitors, including during startup. The server still authenticates every private request. `APP_ORIGIN` must match the browser origin exactly. An optional [Docker Compose database](compose.yaml) is included; the guide covers its setup. Production requires HTTPS and `NODE_ENV=production`.

## Your notebook

Profile/music metadata, daily notes, blogs/stories, tasks, resource links, anime logs, reminders, imported TXT/MD books, and bookmarks live in PostgreSQL. The server confirms writes before the app changes saved state. Conflicting edits preserve the open form so you can review them.

New entries and anime logs start as drafts. Save, reopen Edit, and choose **Publish saved version** to share them. Profile visibility is controlled separately in **Edit my corner**. Music of the Day (title, artist, artwork, and listening link) is always visible to visitors, even when the rest of the profile is private; only the owner can change it. Tasks, links, reminders, books, and reading positions stay private. Published edits update the live record immediately. Delete moves records to recoverable **Trash**.

Import PDF/EPUB files up to 50 MiB each, or TXT/MD up to 10 MiB, into your private library. Create series folders, select a folder before uploading volumes, or move an existing volume with **Edit title / folder**. Directory imports preserve directory groupings as folder labels. Each file becomes a book; repeat uploads create additional copies. PDF has page navigation and zoom; EPUB has chapter navigation, illustrations, and adjustable text. **Keep my place** saves PDF pages or EPUB sections/approximate scroll positions across devices. Original files, folders, and reading positions are included in server backups. See the [reading-room guide](NOVEL-LIBRARY.md) for controls and limits.

On home, load a YouTube watch/youtu.be link to save its title, artist/channel, thumbnail, and listening URL. Listening opens YouTube; the website does not store audio. Weather requests browser location only when clicked and fetches [Open-Meteo](https://open-meteo.com/en/docs) data without storing a history.

## Move your existing data

Before editing the new server notebook, use the same browser origin as before, sign in, and open **Backup & import → Export old browser data**. It reads both the old localStorage notebook and IndexedDB novels without changing them. Keep the downloaded original, select it for preview, and import it into the empty server notebook. All imported content starts private.

The import validates all records, maps filename-based book IDs to UUIDs with bookmarks intact, and commits transactionally. Repeating the same source/file is safe. Imports never replace a populated/edited server notebook. See [migration instructions and limits](DATABASE-SETUP.md).

Download server backups through **Backup & import**. They include active notebook records and book text, excluding credentials, sessions, and trash. Restore needed trash records before exporting. Keep private backups outside the deployed project and configure regular database backups separately. Browser storage is retained only as a migration source; new edits do not write to localStorage or IndexedDB.

Public pages read the API. `data/site-content.js` is no longer the live data source. **Export public pages** remains available as a static snapshot of published material only.

## Documentation and structure

- [Database setup](DATABASE-SETUP.md): configuration, owner setup/recovery, migration, backup and operations.
- [Database design](DATABASE-DESIGN.md): relationship diagrams and modeling rationale.
- [Current API/reference](API-REFERENCE.md): server modules, implemented endpoints and limits.
- [HTML editing guide](EDITING-GUIDE.md): layouts, shared templates and hooks.
- [Version 2.0.0 notes](versions/2026-11-06-postgresql.md): changes and verification.
- [Version-1 project report](PROJECT-REPORT.md) and [version-1 code reference](CODE-REFERENCE.md): historical layout/source context; storage contracts are superseded.

| Path | Purpose |
| --- | --- |
| `pages/`, `templates/` | Complete page layouts and reusable HTML forms/cards |
| `assets/` | CSS, browser behaviour, artwork and fonts |
| `server/` | Authentication, validation, API, data operations, SQL and grants |
| `scripts/` | HTTP server and administrative CLIs |
| `data/` | Source-controlled changelog and legacy public snapshot |
| `tests/` | Frontend contracts, PostgreSQL/API integration, mocked music API |
| `docs/` | Setup, designs, references and version notes |

The extractor at `pages/ultilities.html` still calls its separate `http://localhost:5000/api/analyze` service; that original backend is outside this database implementation. `pages/utilities.html` is the notebook toolbox.

## Verify

```powershell
npm test
```

Version 2.0.0 passes 24 frontend/static scenarios, 13 database/API integration scenarios using an embedded PostgreSQL engine, and 7 mocked music API scenarios. This includes restricted-role access, publication/privacy, stale edits, book/bookmark conversion, transactional rollback, and import retry. Native PostgreSQL can be tested with an empty dedicated `TEST_DATABASE_URL`; see the setup guide. Browser automation was unavailable during implementation, so interactive browser/layout checks remain outstanding. No existing browser data was migrated and no deployment was made.

Record future changes in `docs/versions/` and prepend `data/changelog.json` with the version, date, title, changes, and notes path. The archive page reads this file.
