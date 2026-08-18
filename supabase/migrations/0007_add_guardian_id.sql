-- MakerStudio 마이그레이션 0007 - profiles에 guardian_id 컬럼 추가
-- (0001_init.sql에는 정의돼 있었으나 실제 DB에는 반영되지 않았던 것을 발견,
--  2026-08-19 SQL Editor로 실제 반영 후 파일로도 기록)

alter table public.profiles
  add column if not exists guardian_id uuid references public.profiles(id) on delete cascade;

create index if not exists idx_profiles_guardian_id on public.profiles(guardian_id);
