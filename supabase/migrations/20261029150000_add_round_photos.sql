-- 라운드 사진 (2026-10-29)
-- 사진 파일은 Storage 버킷 round-photos 에, 어느 라운드의 사진인지는 round_photos 표에 기록한다.
-- 이 파일은 두 번 실행해도 안전하다.

-- 1. 사진 목록 표
create table if not exists round_photos (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references rounds(id) on delete cascade,
  user_id uuid references auth.users(id),
  path text not null,
  created_at timestamptz not null default now()
);

create index if not exists round_photos_round_id_idx on round_photos(round_id);

alter table round_photos enable row level security;

-- 읽기: 누구나 (공유 링크 페이지가 로그인 없이 읽는다)
drop policy if exists "round_photos select" on round_photos;
create policy "round_photos select" on round_photos
  for select to anon, authenticated using (true);

-- 추가·삭제: 로그인(익명 포함) 사용자가 자기 것만
drop policy if exists "round_photos insert" on round_photos;
create policy "round_photos insert" on round_photos
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "round_photos delete" on round_photos;
create policy "round_photos delete" on round_photos
  for delete to authenticated using (user_id = auth.uid());

-- 2. Storage 버킷: 공개 읽기, 한 파일 5MB 제한, 이미지만
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('round-photos', 'round-photos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- 파일 경로는 {user_id}/{round_id}/{uuid}.jpg — 첫 폴더가 올린 사람의 user_id
drop policy if exists "round-photos select" on storage.objects;
create policy "round-photos select" on storage.objects
  for select to anon, authenticated using (bucket_id = 'round-photos');

drop policy if exists "round-photos insert" on storage.objects;
create policy "round-photos insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'round-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "round-photos delete" on storage.objects;
create policy "round-photos delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'round-photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- 3. API 스키마 캐시 갱신 (새 표가 바로 보이도록)
notify pgrst, 'reload schema';
