# Run the PostgreSQL notebook

Version 2.0.0 · 6 November 2026

The implementation uses Node.js and the `pg` driver with a real PostgreSQL server. Browser storage is read only when you explicitly export an old notebook. There is no automatic local fallback. The app keeps its existing HTML/CSS and has no build step.

## 1. Install and configure

Requirements: Node.js 22.13 or later, npm, and PostgreSQL 15+ with UTF-8 encoding. Docker Compose is an optional way to run PostgreSQL locally. A hosted database is also supported; use the provider’s verified TLS connection settings. Do not disable certificate validation.

```powershell
npm ci
Copy-Item .env.example .env
```

Edit `.env` locally. Never paste credentials into chat or commit them.

| Setting | Purpose |
| --- | --- |
| `DATABASE_URL` | Restricted application role’s PostgreSQL connection URL |
| `MIGRATION_DATABASE_URL` | Administrator/schema-owner connection for migration and owner CLI only |
| `APP_ORIGIN` | Exact browser origin, initially `http://127.0.0.1:4173` |
| `HOST`, `PORT` | Bind address and port; local default `127.0.0.1:4173` |
| `IMPORT_SIGNING_SECRET` | At least 32 random characters; signs import previews |
| `SITE_OWNER_LOGIN` | Owner whose published content appears publicly |
| `SESSION_DAYS` | Login lifetime, 1–90 days, default 7 |
| `POSTGRES_ADMIN_PASSWORD` | Only for the optional Compose database |

Generate the signing secret locally:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Do not reuse the example `CHANGE_ME` values. URL-encode special characters in database passwords inside connection URLs. A database URL is a server secret; browser JavaScript does not need it.

## 2. Create a database

If you already have PostgreSQL, create a dedicated UTF-8 `picturebook` database and schema-owner account using its administration tools. Skip the Docker commands below.

For the optional local container, start Docker Desktop, set `POSTGRES_ADMIN_PASSWORD` in `.env`, and run:

```powershell
docker compose up -d db
docker compose exec db psql -U picturebook_admin -d picturebook
```

In the SQL terminal, create the restricted application login, then set its password through psql’s hidden prompt:

```sql
CREATE ROLE picturebook_app LOGIN;
\password picturebook_app
\q
```

Set `DATABASE_URL` to that application login. Set `MIGRATION_DATABASE_URL` to the administrator connection. For Compose these connect to `127.0.0.1:5432/picturebook` with the respective credentials. The database port is bound to loopback only, and data survives container restarts in a named volume. Do not remove the volume as a routine restart operation. Changing `POSTGRES_ADMIN_PASSWORD` later does not rotate an existing database account’s password.

## 3. Apply schema, grant runtime access, and create the owner

```powershell
npm run db:migrate
```

The migration is transactional, uses a migration lock, and records its checksum. Rerunning it applies only pending migrations; editing an already-applied file is rejected. Version 2.1.0 has twelve domain tables (including novel series folders), an `import_receipts` operational table, and `schema_migrations` history.

If migration fails, run `node --env-file-if-exists=.env scripts/diagnose-db.mjs`. It checks the selected connection and schema-creation permission without printing credentials. An empty `MIGRATION_DATABASE_URL` falls back to `DATABASE_URL`, whose restricted application role normally cannot create tables. For the local Compose database only, `node --env-file-if-exists=.env scripts/configure-local-migration.mjs` can verify the administrator password from `.env` and populate the missing migration URL. It leaves the application URL unchanged and refuses to overwrite an existing migration connection. Use the password the container was originally initialized with; changing a Compose environment variable does not change an existing database password.

As administrator, apply [server/grants.sql](../server/grants.sql). It assumes the database and runtime role names above; adapt those two names if yours differ. With a local `psql` client:

```powershell
psql --dbname=YOUR_ADMIN_CONNECTION_URL --file=server/grants.sql
```

Prefer a saved connection service or password prompt over putting a real password in shell history. For Docker, copy the nonsecret grants file into the container and execute it:

```powershell
docker compose cp server/grants.sql db:/tmp/picturebook-grants.sql
docker compose exec db psql -U picturebook_admin -d picturebook -f /tmp/picturebook-grants.sql
npm run db:owner
```

The owner CLI prompts for a login and a password of at least 12 characters. Password entry is hidden. This is the website owner login, separate from the PostgreSQL login. Set `SITE_OWNER_LOGIN` to this owner login.

To recover the website password later, use administrator access and:

```powershell
npm run db:owner -- --reset-password
```

This also revokes existing sessions. There is no public registration or email password reset. Keep the administrator connection out of the deployed app process; supply it only to administrative CLI commands in production.

## 4. Start and sign in

```powershell
npm start
```

Open **http://127.0.0.1:4173/pages/owner.html** to sign in, then return to the home page automatically. Bookmark this unlinked owner page: public pages have no sign-in buttons. A valid remembered session reveals owner controls; visitors see neither editing controls nor music/upload inputs. Session cookies, rather than IP addresses or the hidden URL, establish owner access. Use the exact `APP_ORIGIN`: `localhost` and `127.0.0.1` are different origins. For production, set `NODE_ENV=production`, use an HTTPS `APP_ORIGIN`, and place the Node server behind an HTTPS reverse proxy. The browser session cookie becomes Secure on HTTPS. Production startup rejects an HTTP origin.

The server refuses to start without the database/signing-secret configuration. It checks migration history at startup. It serves only website asset/document paths; server code, dependencies, backups, SQL, `.env`, and package manifests are excluded from static serving.

## 5. Migrate the old browser notebook first

Before creating or editing server records:

1. Use the same browser, host, and port where your old notebook was saved.
2. Sign in, then open **Backup & import**.
3. Choose **Export old browser data**. This reads the existing `philine-picturebook-v1` localStorage key and the `philine-books` IndexedDB store. It downloads a backup and leaves both stores intact.
4. Keep that original backup somewhere private outside the deployed site.
5. Give the import a source name, such as `legacy-browser`. Select the backup file and review the server-validated counts.
6. Choose **Import this preview**. The server writes the profile, records, book text, and UUID-mapped bookmarks together in one transaction. Imported profile text and records start private/draft; Music of the Day is visible to visitors independently of profile visibility.
7. Review the notebook, open a novel, check its bookmark and music labels, and download a fresh server backup.

Imports initialize an empty, unedited account, including no trash. Editing the initial profile increments its revision and prevents an import from replacing it. Identical source/file retries return the committed receipt without duplicating data. A changed file under the same source, a different file after initialization, or a nonempty destination is rejected. Automatic merging and destructive restore are deliberately not available. An import preview expires after 15 minutes and is bound to the exact file and owner.

Limits: 60 MiB backup file in the UI, 64 MiB API envelope, 10 MiB per book in UTF-8, 10,000 records per notebook collection, and 1,000 books per legacy backup. Very large libraries need a separately planned batched migration; do not truncate the source. Invalid dates, numbers, statuses, duplicate IDs, unknown record fields, and orphan bookmarks cause an error before commit. Existing array ordering is preserved within each imported collection; new records appear first. There is no automatic scanning of another browser’s storage.

## 6. Publishing, reading, and trash

- New notes, blogs/stories, and anime logs are drafts. Save them first, reopen **Edit**, then choose **Publish saved version** and confirm.
- **Save published changes** updates the live published record immediately. Separate draft edits of a live version are not supported.
- Profile visibility is set in **Edit my corner**. Music of the Day is always visible to visitors, independently of profile visibility; only the owner can change it.
- Tasks, resource links, reminders, books, and bookmarks remain private.
- **Delete** moves a record to **Trash**. Restore it through the footer. A restored published record becomes visible again. There is no permanent-delete button or automatic trash purge in this release.
- Book uploads create new copies. Text is fetched only when opening a book. Original local files stay unchanged. **Keep my place** saves percentage, font size, and theme across devices; scroll percentage is approximate across screen sizes.
- Stale edits show an error and keep the editor’s unsaved input. Copy the text, reload the page, review the newer record, and reapply the intended changes.

Server notebook exports include active records and book text, but omit trash, credentials, sessions, and operational receipts. Restore needed trash items before exporting. Public static export contains only public profile fields and published records; it is no longer the live site’s data source.

## 7. Verification and operations

```powershell
npm test
```

The suite covers frontend/template contracts, database constraints, real HTTP API requests, owner isolation, publication filtering, stale revisions, book text/bookmarks, migration retry, rollback under an injected database failure, export, session revocation, and mocked music upstream errors. The default integration test uses an ephemeral embedded PostgreSQL engine (PGlite), not SQL mocks or the production persistence backend.

For native PostgreSQL verification, point `TEST_DATABASE_URL` at an **empty, disposable, dedicated test database** and run `node tests/database.mjs`. It creates schema and test accounts there; it must never point at the real notebook database. The test account needs migration privileges. The suite leaves that native test database populated for inspection; use a fresh test database for each run.

The implementation was verified with the embedded engine. Native PostgreSQL service, deployment TLS, and interactive browser checks require the corresponding local/hosted services. The browser automation host was unavailable during this implementation; DOM-stub checks do not establish visual or complete browser interaction correctness.

Use administrator `pg_dump --format=custom` backups with private storage and appropriate retention. Practice `pg_restore` into a separate recovery database before relying on backups; a notebook JSON export does not replace a database backup. No automated backup scheduler is installed by this project. Restrict the application database login to the grants file; do not run the app as superuser/schema owner. API ownership predicates enforce access in this release; RLS is not enabled.

References: [PostgreSQL constraints](https://www.postgresql.org/docs/18/ddl-constraints.html), [node-postgres parameterized queries](https://node-postgres.com/features/queries), and [transaction connection requirements](https://node-postgres.com/features/transactions).
