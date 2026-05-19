/*
  # Add approach result and putt miss columns to holes table

  1. Changes
    - `approach1_result` (text): 1번 어프로치 결과 (그린 온 / 그린 미스)
    - `approach2_result` (text): 2번 어프로치 결과 (그린 온 / 그린 미스)
    - `putt_miss` (text): 퍼팅 미스 유형 (숏퍼팅 미스 / 거리감 미스)

  2. Notes
    - 기존 데이터 보존 (NULL → 빈 문자열 기본값)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'holes' AND column_name = 'approach1_result'
  ) THEN
    ALTER TABLE holes ADD COLUMN approach1_result text NOT NULL DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'holes' AND column_name = 'approach2_result'
  ) THEN
    ALTER TABLE holes ADD COLUMN approach2_result text NOT NULL DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'holes' AND column_name = 'putt_miss'
  ) THEN
    ALTER TABLE holes ADD COLUMN putt_miss text NOT NULL DEFAULT '';
  END IF;
END $$;
