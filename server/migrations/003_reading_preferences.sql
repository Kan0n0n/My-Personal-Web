ALTER TABLE reading_progress ADD COLUMN reader_font_family text NOT NULL DEFAULT 'georgia'
  CHECK (reader_font_family IN ('georgia','overlock','palatino','arial','verdana','monospace'));
ALTER TABLE reading_progress ADD COLUMN view_anchor jsonb NOT NULL DEFAULT '{}'::jsonb;
