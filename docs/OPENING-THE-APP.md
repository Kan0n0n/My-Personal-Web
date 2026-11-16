# Opening Picture Book and viewing its database

## Each time you reopen the app

Double-click **Start Picture Book.cmd** in the project folder. You can right-click it and create a desktop shortcut for easier access.

The launcher uses the settings in `.env`, starts Docker Desktop if your local Compose database needs it, starts PostgreSQL, checks database/schema access, starts Node.js, and opens the home page. Docker can take about two minutes after a reboot. If the website is already running, the launcher opens it again without starting a second copy.

Keep the launcher window open while using the app. Press **Ctrl+C** to stop the website (confirm the batch termination prompt if Windows shows one). Closing a browser tab does not stop the website. PostgreSQL and Docker remain running; your records persist in the Docker volume. You may stop Docker Desktop after you finish using the app.

For editing, open http://127.0.0.1:4173/pages/owner.html and sign in. A remembered session normally lasts seven days. The launcher opens the home page at your configured `APP_ORIGIN`.

Installation, configuring `.env`, migrations, grants, and creating the owner account are one-time setup steps described in [database setup](DATABASE-SETUP.md). Do not repeat them every time. Run migrations again when a future update adds schema changes. The launcher reports missing setup; it does not replace passwords or create an account.

If startup fails, its window stays open with a message. Start Docker Desktop manually if it asks for setup, an update, or WSL configuration, then retry. The automatic database startup targets only this project's local `picturebook` database on port 5432; other database configurations must be started separately.

For terminal use:

```powershell
# Check configuration without starting services or opening the browser.
node --env-file-if-exists=.env scripts/boot.mjs --check
# Start the app and open the browser (omit --check).
node --env-file-if-exists=.env scripts/boot.mjs
# Start normally, but leave browser opening to you.
node --env-file-if-exists=.env scripts/boot.mjs --no-browser
```

## See the PostgreSQL tables in pgAdmin

PostgreSQL is the database service; pgAdmin is a separate graphical viewer. Download the Windows desktop version from [pgAdmin](https://www.pgadmin.org/download/pgadmin-4-windows/), install it, and open it. Start the app first so PostgreSQL is running.

Right-click **Servers → Register → Server**. Under **General**, enter any name, such as `Picture Book`. Under **Connection**, use the following settings for this project's current local configuration:

| Field | Value |
| --- | --- |
| Host name/address | `127.0.0.1` |
| Port | `5432` |
| Maintenance database | `picturebook` |
| Username | `picturebook_app` |
| Password | The database password in your local `.env` `DATABASE_URL` |

The URL has the form `postgresql://USER:PASSWORD@HOST:PORT/DATABASE`. Decode any URL-encoded password characters when entering the password into pgAdmin. This password is separate from your website owner password. See the official [connection dialog instructions](https://www.pgadmin.org/docs/pgadmin4/latest/server_dialog.html).

After saving the connection, expand **Servers → Picture Book → Databases → picturebook → Schemas → public → Tables**. Right-click a table and select **View/Edit Data → First 100 Rows**.

| Table | Contains |
| --- | --- |
| `profiles` | Profile and music settings |
| `entries` | Daily notes, blog posts, and stories |
| `tasks` | Work board tasks |
| `resource_links` | Saved resource links |
| `anime_logs` | Anime notebook |
| `reminders` | Calendar reminders |
| `books` | Imported book metadata |
| `book_folders` | Novel series folders |
| `book_contents` | Imported text and original PDF/EPUB bytes |
| `reading_progress` | Reading positions and preferences |

Use the website for ordinary edits so validation, revisions, and publication rules are applied. The application database login has access to private notebook data; do not share its credentials. Some authentication and migration tables are restricted to the administrator.

## See tables without installing a viewer

Open PowerShell in the project folder and run:

```powershell
docker compose exec db psql -U picturebook_admin -d picturebook
```

Then enter:

```sql
\dt
SELECT title, entry_date, publication_state FROM entries LIMIT 20;
SELECT title FROM books LIMIT 20;
\q
```

`\dt` lists the tables; `\q` exits. These queries only read data. This terminal uses the Compose database administrator.
