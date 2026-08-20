-- 0015_family_payments.sql
-- payments 테이블이 개인 구독(subscriptions)뿐 아니라 Family 결제도 기록하도록 확장.
--
-- 지금까지 activateFamilyGroup()은 family_groups만 갱신하고 payments엔 아무것도 남기지
-- 않아서, Family 결제가 결제내역(/mypage/billing)·환불 계산에 전혀 반영되지 않았다
-- (2026-08-20 결정, MVP_Scope v1.3 §2 제외 목록). 이 마이그레이션은 그 다음 단계의 첫
-- 걸음 — subscription_id를 nullable로 바꾸고 family_group_id를 추가해서, payments 한
-- 행이 "개인 구독 결제" 또는 "Family 결제" 둘 중 하나를 가리키게 한다.

alter table public.payments
  alter column subscription_id drop not null;

alter table public.payments
  add column family_group_id uuid references public.family_groups(id);

-- 정확히 하나만 채워져야 한다 — 둘 다 null이거나 둘 다 값이 있으면 안 됨.
alter table public.payments
  add constraint payments_subscription_or_family_group check (
    (subscription_id is not null and family_group_id is null)
    or (subscription_id is null and family_group_id is not null)
  );

comment on column public.payments.family_group_id is 'Family 요금제 결제일 때만 채워짐. subscription_id와는 배타적 — payments_subscription_or_family_group 제약으로 강제.';
