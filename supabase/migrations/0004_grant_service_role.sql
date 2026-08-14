-- MakerStudio 마이그레이션 0004 — service_role 테이블 권한 부여
-- 2026-08-14 발견된 진짜 근본 원인 수정
--
-- 문제: Supabase 프로젝트 생성 시 "Automatically expose new tables"를 꺼뒀는데(보안 강화 목적),
-- 이 설정이 "API 노출"뿐 아니라 "새 테이블에 service_role 권한을 자동으로 부여하는 것"까지
-- 같이 꺼버렸다. 그 결과 0001~0003에서 SQL Editor로 직접 만든 모든 테이블이
-- service_role조차 못 읽고 못 쓰는 상태였다 (Postgres 에러 42501: permission denied).
--
-- 실제 로그로 확인된 증상:
--   {"code":"42501","message":"permission denied for table profiles",
--    "hint":"Grant the required privileges to the current role with:
--             GRANT SELECT ON public.profiles TO service_role;"}
--
-- 이 문제는 profiles뿐 아니라 0001~0003에서 만든 모든 테이블에 동일하게 적용되므로,
-- 개별 테이블마다 따로 권한을 주는 대신 스키마 전체에 한 번에 부여한다.

grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

-- 지금 있는 테이블뿐 아니라, 앞으로 새로 만드는 테이블도 자동으로 service_role 권한을 받도록
-- 기본 권한 규칙을 설정한다. 이걸 안 해두면 다음에 테이블을 하나 더 추가할 때마다
-- 이번과 똑같은 문제가 반복된다.
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to service_role;
alter default privileges in schema public grant execute on functions to service_role;

comment on schema public is
  '2026-08-14: service_role에 스키마 전체 권한 명시적 부여(및 향후 테이블 자동 적용) —
   "Automatically expose new tables" 비활성화로 인해 누락됐던 기본 권한을 복구.';
