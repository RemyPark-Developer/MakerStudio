-- 0029_grant_content_modules_public_read.sql
-- content_modules_public_read_published 정책(0010, status='published'만 select, roles='public')이
-- anon/authenticated 어느 쪽으로도 GRANT가 없어서 실제로는 항상 42501로 막혀 있었다
-- (이 프로젝트의 다른 테이블들과 동일한 원인). 정책 주석이 "나중에 클라이언트에서 직접
-- 조회할 경우를 대비"라고 명시한 원래 설계 의도대로 anon까지 GRANT한다.
--
-- ⚠️ 절대 원칙 2번(Premium 콘텐츠 SSG 금지) 관련 주의사항 — content_generation_log는
-- 대상에서 제외했다: 관리자 전용 내부 진단 로그라 클라이언트가 볼 이유가 없고, RLS도
-- 정책도 원래 없어서(=service_role 전용이 의도된 설계) 손댈 필요가 없다.
--
-- content_modules는 지금 is_premium 컬럼이 없어(전부 무료 취급, DB_Schema/CLAUDE.md
-- 참고) 이 GRANT가 안전하지만, 나중에 is_premium을 추가하면 이 정책(status='published'만
-- 확인, premium 여부는 확인 안 함)도 반드시 같이 고쳐야 한다 — 안 고치면 PostgREST
-- 직접 접근으로 code/explain이 anon에게 그대로 노출되는 우회경로가 생긴다(API 레이어의
-- lib/content/gate.ts 게이팅을 무시하고 지나감).

grant select on public.content_modules to anon, authenticated;
