/*
  # Add unique constraint on (round_id, hole_number)

  Enables upsert operations so saving the same hole twice
  updates the existing row instead of inserting a duplicate.
  Duplicate rows (same round_id + hole_number) are deduplicated
  first by keeping the row with the highest total_strokes.
*/

-- Remove duplicate rows keeping one per (round_id, hole_number)
DELETE FROM holes
WHERE id NOT IN (
  SELECT DISTINCT ON (round_id, hole_number) id
  FROM holes
  ORDER BY round_id, hole_number, total_strokes DESC
);

-- Add unique constraint
ALTER TABLE holes
  ADD CONSTRAINT holes_round_id_hole_number_key UNIQUE (round_id, hole_number);
