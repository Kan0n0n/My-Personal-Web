ALTER TABLE reading_progress ADD COLUMN text_alignment text NOT NULL DEFAULT 'left'
  CHECK (text_alignment IN ('left','center','right','justify'));
ALTER TABLE reading_progress ADD COLUMN speech_preferences jsonb NOT NULL DEFAULT '{}'::jsonb;
