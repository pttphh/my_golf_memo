/*
  # Add second shot miss detail columns to holes table

  1. New Columns
    - `second1_miss_detail` (text): 세컨샷 1번 그린 미스 세부 항목 (쉼표 구분 다중 선택)
    - `second2_miss_detail` (text): 세컨샷 2번 그린 미스 세부 항목
    - `second3_miss_detail` (text): 세컨샷 3번 그린 미스 세부 항목

  2. Notes
    - 기존 데이터 보존 (기본값 빈 문자열)
    - 다중 선택값은 쉼표로 구분하여 저장
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'holes' AND column_name = 'second1_miss_detail'
  ) THEN
    ALTER TABLE holes ADD COLUMN second1_miss_detail text NOT NULL DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'holes' AND column_name = 'second2_miss_detail'
  ) THEN
    ALTER TABLE holes ADD COLUMN second2_miss_detail text NOT NULL DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'holes' AND column_name = 'second3_miss_detail'
  ) THEN
    ALTER TABLE holes ADD COLUMN second3_miss_detail text NOT NULL DEFAULT '';
  END IF;
END $$;
