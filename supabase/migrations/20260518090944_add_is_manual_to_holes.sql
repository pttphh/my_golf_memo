/*
  # Add is_manual column to holes table

  - Adds `is_manual` (boolean, default false) to holes if it does not already exist
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'holes' AND column_name = 'is_manual'
  ) THEN
    ALTER TABLE holes ADD COLUMN is_manual boolean NOT NULL DEFAULT false;
  END IF;
END $$;
