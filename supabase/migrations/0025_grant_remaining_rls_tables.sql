-- 0025_grant_remaining_rls_tables.sql
-- [[project-rls-missing-grants-other-tables]]에 남아있던 마지막 3곳(4개 테이블)의
-- authenticated GRANT 보완. 전부 이미 RLS+정책은 있지만(0008, 0012, 0013),
-- authenticated GRANT가 없어서 실제 JWT로는 항상 42501이 나던 문제 — payments/
-- subscriptions/notifications(0022/0023), family_groups/family_group_members(0023/0024)와
-- 동일 원인·동일 패턴으로 마저 정리한다. 기존 정책은 전부 그대로 둔다.
--
-- content_review_messages는 admin 전용 select 정책(profiles.role='admin' 체크)이지만,
-- Postgres GRANT는 role 단위지 "profiles.role='admin'인 행" 단위가 아니다 — GRANT는
-- authenticated 전체에 주고, admin만 보이게 하는 건 정책이 그대로 담당한다(다른
-- admin 정책들과 동일한 구조, 0022의 subscriptions_admin_select 참고).

grant select, insert, update on public.learning_progress to authenticated;
grant select, insert on public.quiz_attempts to authenticated;
grant select on public.tutor_messages to authenticated;
grant select on public.content_review_messages to authenticated;
