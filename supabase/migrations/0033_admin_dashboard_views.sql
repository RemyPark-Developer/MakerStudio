-- 0033_admin_dashboard_views.sql
-- 관리자 대시보드 집계 뷰 3개. ⚠️ authenticated/anon에 GRANT하지 않는다 — Postgres 뷰는
-- 소유자 권한으로 실행되어 RLS를 우회하므로, GRANT를 주면 student_child를 포함한 모든
-- 인증 사용자가 payments/subscriptions RLS를 건너뛰고 전체 매출·구독자 수를 볼 수
-- 있게 된다. service_role 전용(app/api/billing/dashboard/route.ts가 admin 확인 후 조회).

-- 1) 월별 매출 (개인+Family 통합 — payments가 0015부터 이미 한 테이블이라 union 불필요)
create or replace view public.admin_monthly_revenue as
select
  date_trunc('month', paid_at) as month,
  sum(amount)::bigint as revenue,
  count(*) as payment_count
from public.payments
where status = 'success'
group by date_trunc('month', paid_at)
order by month;

-- 2) 요금제별 고객 수 (premium/family만 — subscriptions.plan='free' row는 실제로 생성된 적이
-- 없어서(activateSubscription은 결제가 실제로 일어날 때만 upsert) 별도 정의가 필요해 이번
-- 범위에서 제외, 2026-08-21 대표님 확인). "고객"의 정의: 잔여기간이 남아있으면 해지해도
-- 카운트한다(§4.3 "해지해도 잔여기간까지는 이용 가능" 원칙, lib/content/gate.ts의
-- hasPremiumAccess()와 동일 정의 재사용).
create or replace view public.admin_plan_customers as
select 'premium' as plan, count(*) as customer_count
from public.subscriptions
where plan = 'premium' and current_period_end >= now()
union all
select 'family', count(*)
from public.family_groups
where current_period_end >= now();

-- 3) 요금제별 이탈률 재료 (이번 달 기준) — status 플래그로 "취소 결정"을 센다(위 고객 수와
-- 달리 접근권(current_period_end) 기준이 아님 — 이탈률은 취소 이벤트 자체를 세는 지표라
-- 대표님이 준 정의(status='canceled' 건수 / 기간 시작 시점 active 건수)를 그대로 따름).
-- active_count + canceled_this_period = "이번 달 시작 시점에 활성이었던 건수"의 근사치 —
-- 이번 달 안에 취소한 사람은 달 시작 시점엔 반드시 활성이었어야 하므로 정확하다.
create or replace view public.admin_plan_churn as
with bounds as (
  select date_trunc('month', now()) as period_start, now() as period_end
)
select
  'premium' as plan,
  count(*) filter (where s.status = 'active') as active_count,
  count(*) filter (
    where s.status = 'canceled' and s.canceled_at >= b.period_start and s.canceled_at < b.period_end
  ) as canceled_this_period
from public.subscriptions s, bounds b
where s.plan = 'premium'
union all
select
  'family',
  count(*) filter (where fg.status = 'active'),
  count(*) filter (
    where fg.status = 'canceled' and fg.canceled_at >= b.period_start and fg.canceled_at < b.period_end
  )
from public.family_groups fg, bounds b;
