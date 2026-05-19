/*
  # PostgREST 스키마 캐시 갱신

  course_front, course_back 컬럼 추가 후 PostgREST 캐시가 갱신되지 않아
  PGRST204 오류가 발생하는 문제를 해결하기 위해 스키마 캐시를 강제 갱신합니다.
*/

NOTIFY pgrst, 'reload schema';
