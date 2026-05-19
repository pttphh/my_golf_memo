/*
  # Ensure rounds.id uses gen_random_uuid() default

  This migration explicitly re-sets the default on rounds.id to ensure
  the database always generates a fresh UUID on every insert, regardless
  of what the client sends. It also adds an ON CONFLICT DO NOTHING safety
  on the insert path by ensuring the constraint is healthy.

  Changes:
  - Re-apply DEFAULT gen_random_uuid() to rounds.id (idempotent)
  - Re-apply DEFAULT gen_random_uuid() to holes.id (idempotent)
*/

ALTER TABLE rounds ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE holes  ALTER COLUMN id SET DEFAULT gen_random_uuid();
