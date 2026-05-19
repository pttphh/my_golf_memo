/*
  # course_front, course_back 컬럼 재생성으로 스키마 캐시 강제 갱신

  PGRST204 오류는 PostgREST가 해당 컬럼을 스키마 캐시에서 인식하지 못할 때 발생합니다.
  컬럼을 DROP 후 재추가하여 PostgREST가 스키마 변경을 감지하도록 강제합니다.

  변경 사항:
  - rounds.course_front: 기존 컬럼 삭제 후 재생성 (text, NOT NULL, DEFAULT '')
  - rounds.course_back: 기존 컬럼 삭제 후 재생성 (text, NOT NULL, DEFAULT '')
*/

ALTER TABLE rounds DROP COLUMN IF EXISTS course_front;
ALTER TABLE rounds DROP COLUMN IF EXISTS course_back;

ALTER TABLE rounds ADD COLUMN course_front text NOT NULL DEFAULT '';
ALTER TABLE rounds ADD COLUMN course_back text NOT NULL DEFAULT '';

NOTIFY pgrst, 'reload schema';
