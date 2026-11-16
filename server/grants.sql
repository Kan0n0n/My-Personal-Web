-- Run as the database administrator AFTER migrations and creation of
-- the picturebook_app LOGIN role. Set its password interactively with psql.
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT CONNECT ON DATABASE picturebook TO picturebook_app;
GRANT USAGE ON SCHEMA public TO picturebook_app;
GRANT SELECT ON accounts, schema_migrations TO picturebook_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON sessions TO picturebook_app;
GRANT SELECT, UPDATE ON profiles TO picturebook_app;
GRANT SELECT, INSERT, UPDATE ON entries, tasks, resource_links, anime_logs,
  reminders, books, book_contents, reading_progress TO picturebook_app;
GRANT SELECT, INSERT ON import_receipts TO picturebook_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON book_folders TO picturebook_app;
