-- 0028_guardian_child_links_owner_select.sql
-- `profiles`의 "Guardians can view linked children profiles" 정책(0027로 백필한, 원래
-- 대시보드에서 만들어졌던 정책)이 guardian_child_links를 서브쿼리로 참조하는데,
-- guardian_child_links 자체엔 RLS는 켜져 있고(GRANT는 있음, 에러는 안 남) 정책이 하나도
-- 없어서 authenticated로는 항상 빈 결과만 나왔다 — 그래서 저 정책이 실제로는 한 번도
-- 정상 동작한 적이 없었다(2026-08-21 재검증 중 발견, 실제 링크 row를 만들어놓고도
-- guardian 토큰으로 0건이 나오는 걸로 확인). 이 마이그레이션으로 guardian 본인이
-- guardian_id인 링크만 보이는 정책을 추가해서 실제로 동작하게 한다.

alter table public.guardian_child_links enable row level security;

grant select on public.guardian_child_links to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'guardian_child_links'
      and policyname = 'Guardians can view own child links'
  ) then
    create policy "Guardians can view own child links"
      on public.guardian_child_links for select
      using (guardian_id = auth.uid());
  end if;
end $$;
