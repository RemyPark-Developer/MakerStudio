-- 0024_grant_family_group_members_select.sql
-- family_group_members_owner_select 정책(0014)이 authenticated GRANT 없이는 실제로
-- 동작하지 않는다 — family_groups에서 이미 같은 문제를 발견·수정했다(0023,
-- payments_guardian_select가 family_groups를 참조할 때 42501이 났던 것과 동일 원인:
-- 이 프로젝트는 anon/authenticated에 대한 기본 GRANT 자체가 없음, → CLAUDE.md 참고).
-- 기존 정책은 그대로 두고 GRANT만 추가한다 — family_group_members에 새 정책을 만드는
-- 것은 이번 범위가 아니다.

grant select on public.family_group_members to authenticated;
