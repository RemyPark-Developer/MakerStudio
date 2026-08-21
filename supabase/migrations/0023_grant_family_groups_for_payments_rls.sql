-- 0023_grant_family_groups_for_payments_rls.sql
-- 0022의 payments_guardian_select 정책은 family_group_id 결제를 판단하려고
-- family_groups를 서브쿼리로 참조한다. 그런데 family_groups엔 (0014가 RLS+정책은
-- 만들었지만) authenticated에 대한 GRANT가 없어서, 정책 평가 자체가 42501로
-- 실패해 payments 조회가 통째로 깨지는 걸 실증 테스트로 발견했다(2026-08-21).
--
-- family_groups의 기존 정책(family_groups_owner_select, 0014)은 그대로 둔다 — 이
-- GRANT를 추가해도 실제로 보이는 행은 여전히 본인 소유 그룹뿐이다(RLS가 그대로 필터링).
-- family_groups/family_group_members에 새 정책을 추가하는 것은 이번 범위가 아니다.

grant select on public.family_groups to authenticated;
