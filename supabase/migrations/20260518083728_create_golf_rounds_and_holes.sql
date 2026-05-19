/*
  # Golf Round Tracker - Initial Schema

  ## New Tables

  ### rounds
  - id (uuid, primary key)
  - created_at (timestamptz)
  - date (text) - round date (YYYY-MM-DD)
  - time (text) - round start time (HH:MM)
  - course_name (text)
  - companion1, companion2, companion3 (text, nullable) - playing partners

  ### holes
  - id (uuid, primary key)
  - round_id (uuid, FK -> rounds.id)
  - hole_number (int) - 1..18
  - par (int) - 3/4/5
  - green_shots (int) - shots to reach green
  - putts (int)
  - total_strokes (int)
  - over_par (int)
  - is_manual (bool)
  - Tee shot: tee_club, tee_result, tee_penalty_type, tee_miss, tee_memo
  - Second shots (up to 3): second1_*, second2_*, second3_*
  - Approach shots (up to 2): approach1_*, approach2_*
  - Putting: putt_memo

  ## Security
  - RLS enabled on both tables
  - Public read/write policies for anon and authenticated users
*/

CREATE TABLE IF NOT EXISTS rounds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  date text NOT NULL DEFAULT '',
  time text NOT NULL DEFAULT '',
  course_name text NOT NULL DEFAULT '',
  companion1 text DEFAULT '',
  companion2 text DEFAULT '',
  companion3 text DEFAULT ''
);

ALTER TABLE rounds ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='rounds' AND policyname='Anyone can select rounds') THEN
    CREATE POLICY "Anyone can select rounds" ON rounds FOR SELECT TO anon, authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='rounds' AND policyname='Anyone can insert rounds') THEN
    CREATE POLICY "Anyone can insert rounds" ON rounds FOR INSERT TO anon, authenticated WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='rounds' AND policyname='Anyone can update rounds') THEN
    CREATE POLICY "Anyone can update rounds" ON rounds FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='rounds' AND policyname='Anyone can delete rounds') THEN
    CREATE POLICY "Anyone can delete rounds" ON rounds FOR DELETE TO anon, authenticated USING (true);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS holes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  round_id uuid NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  hole_number int NOT NULL,
  par int NOT NULL DEFAULT 4,
  green_shots int NOT NULL DEFAULT 0,
  putts int NOT NULL DEFAULT 0,
  total_strokes int NOT NULL DEFAULT 0,
  over_par int NOT NULL DEFAULT 0,
  is_manual boolean NOT NULL DEFAULT false,

  tee_club text DEFAULT '',
  tee_result text DEFAULT '',
  tee_penalty_type text DEFAULT '',
  tee_miss text DEFAULT '',
  tee_memo text DEFAULT '',

  second1_club text DEFAULT '',
  second1_result text DEFAULT '',
  second1_penalty_type text DEFAULT '',
  second1_miss text DEFAULT '',
  second1_memo text DEFAULT '',

  second2_club text DEFAULT '',
  second2_result text DEFAULT '',
  second2_penalty_type text DEFAULT '',
  second2_miss text DEFAULT '',
  second2_memo text DEFAULT '',

  second3_club text DEFAULT '',
  second3_result text DEFAULT '',
  second3_penalty_type text DEFAULT '',
  second3_miss text DEFAULT '',
  second3_memo text DEFAULT '',

  approach1_club text DEFAULT '',
  approach1_miss text DEFAULT '',
  approach1_memo text DEFAULT '',

  approach2_club text DEFAULT '',
  approach2_miss text DEFAULT '',
  approach2_memo text DEFAULT '',

  putt_memo text DEFAULT ''
);

ALTER TABLE holes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='holes' AND policyname='Anyone can select holes') THEN
    CREATE POLICY "Anyone can select holes" ON holes FOR SELECT TO anon, authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='holes' AND policyname='Anyone can insert holes') THEN
    CREATE POLICY "Anyone can insert holes" ON holes FOR INSERT TO anon, authenticated WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='holes' AND policyname='Anyone can update holes') THEN
    CREATE POLICY "Anyone can update holes" ON holes FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='holes' AND policyname='Anyone can delete holes') THEN
    CREATE POLICY "Anyone can delete holes" ON holes FOR DELETE TO anon, authenticated USING (true);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS holes_round_id_idx ON holes(round_id);
CREATE INDEX IF NOT EXISTS rounds_created_at_idx ON rounds(created_at DESC);
