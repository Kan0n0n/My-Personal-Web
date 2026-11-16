CREATE TABLE book_folders (
  id uuid PRIMARY KEY, owner_id uuid NOT NULL REFERENCES accounts(id),
  title text NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 500),
  revision bigint NOT NULL DEFAULT 1 CHECK (revision > 0),
  UNIQUE(owner_id,id), UNIQUE(owner_id,title)
);
ALTER TABLE books DROP CONSTRAINT books_format_check;
ALTER TABLE books ADD CONSTRAINT books_format_check CHECK (format IN ('txt','md','pdf','epub'));
ALTER TABLE books ADD COLUMN folder_id uuid;
ALTER TABLE books ADD FOREIGN KEY (owner_id,folder_id) REFERENCES book_folders(owner_id,id);
CREATE INDEX books_folder ON books(owner_id,folder_id) WHERE deleted_at IS NULL;
ALTER TABLE book_contents ALTER COLUMN content_text DROP NOT NULL;
ALTER TABLE book_contents ADD COLUMN content_binary bytea CHECK (octet_length(content_binary) <= 52428800);
ALTER TABLE book_contents ADD CHECK (num_nonnulls(content_text,content_binary)=1);
ALTER TABLE reading_progress ADD COLUMN locator text NOT NULL DEFAULT '' CHECK (length(locator)<=200);
-- Existing runtime grants cover the altered tables. Grant the new folder table
-- when this project's application role already exists (fresh setups use grants.sql).
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='picturebook_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON book_folders TO picturebook_app;
  END IF;
END $$;
