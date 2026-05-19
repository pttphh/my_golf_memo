/*
  # Add approach miss detail columns

  Adds approach1_miss_detail and approach2_miss_detail to holes table.
  These store comma-separated sub-selections when approach result is '그린 미스'
  (e.g. "오버,OB"). If columns already exist the block is a no-op.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'holes' AND column_name = 'approach1_miss_detail'
  ) THEN
    ALTER TABLE holes ADD COLUMN approach1_miss_detail text NOT NULL DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'holes' AND column_name = 'approach2_miss_detail'
  ) THEN
    ALTER TABLE holes ADD COLUMN approach2_miss_detail text NOT NULL DEFAULT '';
  END IF;
END $$;
