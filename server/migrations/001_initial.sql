CREATE TABLE accounts (
  id uuid PRIMARY KEY,
  login_name text NOT NULL UNIQUE CHECK (login_name = lower(login_name) AND length(trim(login_name)) > 0),
  password_hash text NOT NULL,
  timezone text NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  disabled_at timestamptz
);
CREATE TABLE sessions (
  token_hash bytea PRIMARY KEY CHECK (octet_length(token_hash) = 32),
  owner_id uuid NOT NULL REFERENCES accounts(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL CHECK (expires_at > created_at),
  revoked_at timestamptz
);
CREATE INDEX sessions_owner ON sessions(owner_id);
CREATE INDEX sessions_expiry ON sessions(expires_at);
CREATE TABLE profiles (
  owner_id uuid PRIMARY KEY REFERENCES accounts(id),
  display_name text NOT NULL CHECK (length(trim(display_name)) > 0),
  bio text NOT NULL DEFAULT '', status text NOT NULL DEFAULT '', intro text NOT NULL DEFAULT '',
  currently_watching text NOT NULL DEFAULT '', currently_playing text NOT NULL DEFAULT '', currently_doing text NOT NULL DEFAULT '',
  song_title text NOT NULL DEFAULT '', song_artist text NOT NULL DEFAULT '',
  music_cover_url text NOT NULL DEFAULT '' CHECK (music_cover_url = '' OR music_cover_url ~ '^https?://'),
  music_url text NOT NULL DEFAULT '' CHECK (music_url = '' OR music_url ~ '^https?://'),
  is_public boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  revision bigint NOT NULL DEFAULT 1 CHECK (revision > 0)
);
CREATE TABLE entries (
  id uuid PRIMARY KEY, owner_id uuid NOT NULL REFERENCES accounts(id),
  kind text NOT NULL CHECK (kind IN ('note','blog','story')),
  title text NOT NULL CHECK (length(trim(title)) > 0), body text NOT NULL CHECK (length(trim(body)) > 0),
  entry_date date NOT NULL, tags_text text NOT NULL DEFAULT '',
  slug text CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  publication_state text NOT NULL DEFAULT 'draft' CHECK (publication_state IN ('draft','published')),
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  revision bigint NOT NULL DEFAULT 1 CHECK (revision > 0), deleted_at timestamptz,
  legacy_source text, legacy_collection text, legacy_id text, legacy_position integer,
  CHECK ((publication_state = 'published') = (published_at IS NOT NULL)),
  CHECK (num_nonnulls(legacy_source, legacy_collection, legacy_id) IN (0,3)),
  UNIQUE(owner_id,slug), UNIQUE(owner_id,legacy_source,legacy_collection,legacy_id)
);
CREATE INDEX entries_owner ON entries(owner_id,kind,entry_date DESC,id) WHERE deleted_at IS NULL;
CREATE INDEX entries_public ON entries(owner_id,kind,entry_date DESC,id) WHERE deleted_at IS NULL AND publication_state='published';
CREATE TABLE tasks (
  id uuid PRIMARY KEY, owner_id uuid NOT NULL REFERENCES accounts(id),
  title text NOT NULL CHECK (length(trim(title)) > 0), note text NOT NULL DEFAULT '', due_date date,
  status text NOT NULL CHECK (status IN ('todo','in_progress','done')),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  revision bigint NOT NULL DEFAULT 1 CHECK (revision > 0), deleted_at timestamptz,
  legacy_source text, legacy_collection text, legacy_id text, legacy_position integer,
  CHECK (num_nonnulls(legacy_source, legacy_collection, legacy_id) IN (0,3)),
  UNIQUE(owner_id,legacy_source,legacy_collection,legacy_id)
);
CREATE INDEX tasks_board ON tasks(owner_id,status,due_date,id) WHERE deleted_at IS NULL;
CREATE TABLE resource_links (
  id uuid PRIMARY KEY, owner_id uuid NOT NULL REFERENCES accounts(id),
  title text NOT NULL CHECK (length(trim(title)) > 0), url text NOT NULL CHECK (url ~ '^https?://'),
  folder_label text NOT NULL DEFAULT '', note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  revision bigint NOT NULL DEFAULT 1 CHECK (revision > 0), deleted_at timestamptz,
  legacy_source text, legacy_collection text, legacy_id text, legacy_position integer,
  CHECK (num_nonnulls(legacy_source, legacy_collection, legacy_id) IN (0,3)),
  UNIQUE(owner_id,legacy_source,legacy_collection,legacy_id)
);
CREATE INDEX resources_owner ON resource_links(owner_id,updated_at DESC,id) WHERE deleted_at IS NULL;
CREATE TABLE anime_logs (
  id uuid PRIMARY KEY, owner_id uuid NOT NULL REFERENCES accounts(id),
  title text NOT NULL CHECK (length(trim(title)) > 0),
  watch_status text NOT NULL CHECK (watch_status IN ('watching','completed','on_hold','planned')),
  rating smallint CHECK (rating BETWEEN 1 AND 5), episodes_watched integer NOT NULL DEFAULT 0 CHECK (episodes_watched >= 0),
  log_date date NOT NULL, thoughts text NOT NULL DEFAULT '', spoilers boolean NOT NULL DEFAULT false,
  publication_state text NOT NULL DEFAULT 'draft' CHECK (publication_state IN ('draft','published')), published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  revision bigint NOT NULL DEFAULT 1 CHECK (revision > 0), deleted_at timestamptz,
  legacy_source text, legacy_collection text, legacy_id text, legacy_position integer,
  CHECK ((publication_state = 'published') = (published_at IS NOT NULL)),
  CHECK (num_nonnulls(legacy_source, legacy_collection, legacy_id) IN (0,3)),
  UNIQUE(owner_id,legacy_source,legacy_collection,legacy_id)
);
CREATE INDEX anime_owner ON anime_logs(owner_id,watch_status,log_date DESC,id) WHERE deleted_at IS NULL;
CREATE INDEX anime_public ON anime_logs(owner_id,log_date DESC,id) WHERE deleted_at IS NULL AND publication_state='published';
CREATE TABLE reminders (
  id uuid PRIMARY KEY, owner_id uuid NOT NULL REFERENCES accounts(id),
  title text NOT NULL CHECK (length(trim(title)) > 0), reminder_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  revision bigint NOT NULL DEFAULT 1 CHECK (revision > 0), deleted_at timestamptz,
  legacy_source text, legacy_collection text, legacy_id text, legacy_position integer,
  CHECK (num_nonnulls(legacy_source, legacy_collection, legacy_id) IN (0,3)),
  UNIQUE(owner_id,legacy_source,legacy_collection,legacy_id)
);
CREATE INDEX reminders_calendar ON reminders(owner_id,reminder_date,id) WHERE deleted_at IS NULL;
CREATE TABLE books (
  id uuid PRIMARY KEY, owner_id uuid NOT NULL REFERENCES accounts(id),
  title text NOT NULL CHECK (length(trim(title)) > 0), source_path text NOT NULL DEFAULT '',
  format text NOT NULL CHECK (format IN ('txt','md')),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  revision bigint NOT NULL DEFAULT 1 CHECK (revision > 0), deleted_at timestamptz,
  legacy_source text, legacy_collection text, legacy_id text, legacy_position integer,
  CHECK (num_nonnulls(legacy_source, legacy_collection, legacy_id) IN (0,3)),
  UNIQUE(owner_id,id), UNIQUE(owner_id,legacy_source,legacy_collection,legacy_id)
);
CREATE INDEX books_shelf ON books(owner_id,title,id) WHERE deleted_at IS NULL;
CREATE TABLE book_contents (
  book_id uuid PRIMARY KEY REFERENCES books(id) ON DELETE CASCADE,
  content_text text NOT NULL,
  utf8_bytes bigint GENERATED ALWAYS AS (octet_length(content_text)) STORED CHECK (utf8_bytes <= 10485760),
  content_sha256 bytea NOT NULL CHECK (octet_length(content_sha256)=32)
);
CREATE TABLE reading_progress (
  owner_id uuid NOT NULL REFERENCES accounts(id), book_id uuid NOT NULL,
  progress_percent numeric(5,2) NOT NULL DEFAULT 0 CHECK (progress_percent BETWEEN 0 AND 100),
  font_size_px smallint NOT NULL DEFAULT 18 CHECK (font_size_px BETWEEN 14 AND 30),
  reader_theme text NOT NULL DEFAULT 'light' CHECK (reader_theme IN ('light','dark')),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  revision bigint NOT NULL DEFAULT 1 CHECK (revision > 0),
  PRIMARY KEY(owner_id,book_id),
  FOREIGN KEY(owner_id,book_id) REFERENCES books(owner_id,id) ON DELETE CASCADE
);
CREATE INDEX progress_book ON reading_progress(book_id);
-- Operational receipt makes committed import retries safe without browser storage.
CREATE TABLE import_receipts (
  owner_id uuid NOT NULL REFERENCES accounts(id), source text NOT NULL,
  checksum text NOT NULL, counts jsonb NOT NULL, committed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(owner_id,source)
);
