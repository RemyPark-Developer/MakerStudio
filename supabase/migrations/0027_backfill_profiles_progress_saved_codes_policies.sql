-- 0027_backfill_profiles_progress_saved_codes_policies.sql
-- `profiles`/`progress`/`saved_codes`에 이미 RLS+정책+GRANT가 실DB에 있었는데(2026-08-21,
-- pg_policies 실증 조회로 발견), 이 저장소의 어떤 마이그레이션 파일에도 정의돼 있지
-- 않았다 — Supabase 대시보드 Table Editor의 "Enable RLS" 원클릭 마법사로 만들어진
-- 것으로 추정(정책 이름 스타일이 영문·대문자 시작으로 이 프로젝트의 다른 정책들과
-- 다름). 이 마이그레이션은 새 코드가 아니라 **이미 있는 실DB 상태를 마이그레이션
-- 이력에 백필(backfill)**하는 것 — 새 Supabase 프로젝트에 0001부터 순서대로 적용해도
-- 이 3개 테이블이 지금 실DB와 동일한 상태가 되도록 재현성을 맞춘다.
--
-- 이미 존재하는 정책이라 `create policy`가 이름 충돌로 실패할 수 있으므로, 존재 확인 후
-- 생성하는 DO 블록으로 idempotent하게 작성한다(이 프로젝트의 기존 컨벤션, 0018/0021 참고).

alter table public.profiles enable row level security;
alter table public.progress enable row level security;
alter table public.saved_codes enable row level security;

grant select on public.profiles to authenticated;
grant select on public.progress to authenticated;
grant select on public.saved_codes to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'profiles' and policyname = 'Users can view own profile'
  ) then
    create policy "Users can view own profile"
      on public.profiles for select
      using (auth.uid() = id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'profiles' and policyname = 'Guardians can view linked children profiles'
  ) then
    create policy "Guardians can view linked children profiles"
      on public.profiles for select
      using (id in (
        select guardian_child_links.child_id
        from guardian_child_links
        where guardian_child_links.guardian_id = auth.uid()
      ));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'progress' and policyname = 'Users can view own progress'
  ) then
    create policy "Users can view own progress"
      on public.progress for select
      using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'saved_codes' and policyname = 'Users can view own saved codes'
  ) then
    create policy "Users can view own saved codes"
      on public.saved_codes for select
      using (auth.uid() = user_id);
  end if;
end $$;
