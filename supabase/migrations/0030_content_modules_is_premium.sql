-- 0030_content_modules_is_premium.sql
-- content_modules(관리자 검수 DB 콘텐츠)에 is_premium 컬럼을 추가한다(2026-08-20에 보류했던
-- 항목, RGB LED 색상 제어 강의를 유료로 팔아야 해서 지금 필요해짐).
--
-- ⚠️ §7.2 원칙 관련 — 0029에서 만든 content_modules_public_read_published 정책
-- (status='published'인 행만 anon/authenticated select 허용)이 premium 여부를 전혀
-- 안 보고 있었다. is_premium 컬럼이 생긴 지금 이 정책을 같이 안 고치면, PostgREST
-- 직접 접근으로 유료 code/explain이 무료 사용자에게 그대로 노출되는 우회경로가 생긴다
-- (API 레이어 lib/content/gate.ts의 게이팅을 완전히 무시하고 지나감) —
-- project_rls_missing_grants_other_tables 메모리에 미리 남겨뒀던 위험이 실제로 닥친 것.
--
-- 그래서 이 마이그레이션은 컬럼 추가와 정책 수정을 같이 묶는다 — 컬럼만 추가하고
-- 정책 수정을 나중으로 미루면, 그 사이 시간동안 실제로 premium 우회 노출 창이 열린다.

alter table public.content_modules
  add column is_premium boolean not null default false;

comment on column public.content_modules.is_premium is '관리자가 검수 승인(status=published) 시점에 결정. app/admin/content-review에서 체크박스로 설정 (2026-08-21).';

alter policy "content_modules_public_read_published"
  on public.content_modules
  using (status = 'published' and is_premium = false);
