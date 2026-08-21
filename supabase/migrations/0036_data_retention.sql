-- 0036_data_retention.sql
-- 해지 후 30일 데이터 보관 정책 — 준비 단계(스키마+수동 스크립트)만. 자동 삭제(cron)는
-- 이번 범위 밖 — 이 컬럼이 추가돼도 지금 당장은 아무것도 자동으로 지워지지 않는다.
--
-- ⚠️ 이 정책의 법적 고지 문구(개인정보처리방침 초안, 가입 동의 화면 문구 등)는 초안이며
-- 실제 법률 검토가 필요하다. 확정된 정책으로 취급하지 말 것.

alter table public.subscriptions add column data_retention_until timestamptz;
alter table public.family_groups add column data_retention_until timestamptz;

comment on column public.subscriptions.data_retention_until is
  '해지 후 학습 데이터 보관 만료 시점(현재 결제기간 종료일 + 30일, canceled_at이 아니라
   current_period_end 기준 — §4.3 "해지해도 잔여기간까지는 이용 가능" 원칙과 일관되게,
   실제 접근이 끊기는 시점부터 30일을 준다). null이면 보관 대상 아님(활성 상태거나
   재구독함). scripts/purge-expired-data.ts가 이 값을 기준으로 파기 대상을 찾는다 — 아직
   자동 실행(cron)에는 연결되지 않았고 관리자가 수동 실행해야 한다(2026-08-22).
   ⚠️ 법적 고지 문구는 초안이며 실제 법률 검토가 필요하다.';
comment on column public.family_groups.data_retention_until is
  'subscriptions.data_retention_until과 동일 원칙 — Family 그룹 전체 해지 시 계산.';
