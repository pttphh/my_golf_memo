/*
  # PostgREST 스키마 캐시 강제 갱신

  rounds 테이블의 course_front, course_back 컬럼이 스키마 캐시에 반영되지 않아
  PGRST204 오류가 발생하는 문제를 해결합니다.
*/

NOTIFY pgrst, 'reload schema';

-- 컬럼 존재 여부를 재확인하고 없으면 추가
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rounds' AND column_name = 'course_front'
  ) THEN
    ALTER TABLE rounds ADD COLUMN course_front text NOT NULL DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rounds' AND column_name = 'course_back'
  ) THEN
    ALTER TABLE rounds ADD COLUMN course_back text NOT NULL DEFAULT '';
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
