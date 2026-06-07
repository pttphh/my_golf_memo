ALTER TABLE rounds ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);
ALTER TABLE rounds ADD COLUMN IF NOT EXISTS memo text NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS rounds_user_id_idx ON rounds(user_id);
