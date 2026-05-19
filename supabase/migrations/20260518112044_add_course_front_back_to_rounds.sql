/*
  # rounds 테이블에 전반/후반 코스명 컬럼 추가

  1. 변경 내용
    - `rounds` 테이블에 `course_front` (text) 컬럼 추가 — 전반 코스명 (선택)
    - `rounds` 테이블에 `course_back` (text) 컬럼 추가 — 후반 코스명 (선택)

  2. 특이사항
    - 기존 라운드 데이터 보존 (빈 문자열 기본값)
    - NULL 허용 없이 DEFAULT '' 로 설정
*/

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
