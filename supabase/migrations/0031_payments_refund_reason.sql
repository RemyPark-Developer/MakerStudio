-- 0031_payments_refund_reason.sql
-- 회사 귀책(중복결제·시스템오류) 전액환불을 자동 판별하려면 우선 그 사유를 기록할 컬럼이
-- 필요하다 — 지금까지는 payments.status에 사유 플래그가 없어 refund/calculate가 이걸
-- 자동 판별할 수 없었다(Session_2026-08-20_Summary_v1.1 §9 "의도적으로 제외한 것",
-- 2026-08-21 대표님 지시로 착수).
--
-- CS/관리자가 이 컬럼을 수동으로 세팅하는 것을 전제로 한다(이번 범위엔 세팅용 admin
-- API/화면이 없음 — 지금은 Supabase 대시보드에서 직접 UPDATE). refund/calculate는 이
-- 컬럼이 채워진 최신 결제 건이 있으면 기간/사용여부와 무관하게 그 결제의 실제 결제금액을
-- 전액 환불한다(lib/billing/companyFaultRefund.ts).
--
-- payments는 이미 0022에서 RLS+테이블 단위 GRANT(select)가 걸려 있어 컬럼 추가만으로
-- 충분하다 — 0022의 grant가 컬럼을 명시하지 않은 테이블 단위 grant였음을 확인함.

alter table public.payments
  add column refund_reason text
  check (refund_reason is null or refund_reason in ('duplicate_payment', 'system_error'));

comment on column public.payments.refund_reason is
  '회사 귀책 환불 사유. null이면 일반 결제. CS/관리자가 수동으로 세팅 — 세팅되면
   refund/calculate가 기간·사용여부 무관하게 이 결제 건을 전액환불 대상으로 판단.';
