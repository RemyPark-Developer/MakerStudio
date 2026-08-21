-- 0022_rls_billing_notifications.sql
-- Auth_Flow.md §3 "API 미들웨어 + RLS 이중 방어" 중 실제로 빠져있던 RLS 레이어를 채운다.
-- payments/subscriptions/notifications는 지금까지 API 미들웨어(service_role, requireGuardian)
-- 로만 방어되고 있었고, DB 자체엔 RLS가 전혀 없었다(2026-08-21 확인).
--
-- ⚠️ 적용 전 실DB 조사에서 발견한 사실: 이 프로젝트는 "Automatically expose new tables"를
-- 끈 채로 SQL Editor에서 테이블을 만들어왔기 때문에(0004_grant_service_role.sql과 같은 원인),
-- anon/authenticated 롤에 대한 기본 GRANT 자체가 없다. RLS 정책만 추가하면 student_child뿐
-- 아니라 guardian 본인도 42501로 막혀서 매트릭스의 "guardian은 본인 것만 R" 부분이 실제로는
-- 동작하지 않는다 — 그래서 GRANT SELECT를 policy와 함께 명시적으로 부여한다.
-- (이 프로젝트는 브라우저가 Supabase에 직접 붙는 경로가 없어 지금 당장은 GRANT가 없어도
-- 안전했지만, 이번 변경으로 문서가 약속하는 이중 방어가 이름 그대로 실제로 동작하게 만든다.)
--
-- 쓰기(INSERT/UPDATE/DELETE) 정책은 만들지 않는다 — 모든 실제 쓰기는 이미 service_role
-- (checkout/verify, webhook, activateSubscription, notifyGuardian)로만 이뤄지고 있어서
-- (2026-08-21 grep으로 재확인, 브라우저용 Supabase 클라이언트 자체가 없음), 정책이 없으면
-- 나중에 실수로 anon/authenticated 키가 노출돼도 쓰기가 막힌다(0014 family_groups와 동일 설계).
-- notifications의 "읽음 처리"만 예외 — 사용자 본인이 직접 update할 수 있어야 하는 row 단위
-- 동작이라 update 정책 + grant를 명시적으로 둔다(0008 learning_progress와 동일 패턴).

alter table public.subscriptions enable row level security;

grant select on public.subscriptions to authenticated;

create policy "subscriptions_guardian_select"
  on public.subscriptions for select
  using (guardian_id = auth.uid());

create policy "subscriptions_admin_select"
  on public.subscriptions for select
  using (exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and profiles.role = 'admin'
  ));

alter table public.payments enable row level security;

grant select on public.payments to authenticated;

-- payments엔 guardian_id가 직접 없다 — subscriptions(개인 구독) 또는 family_groups(Family)
-- 경유로 소유자를 판단한다(0015_family_payments.sql의 배타적 컬럼 설계 그대로 반영).
create policy "payments_guardian_select"
  on public.payments for select
  using (
    exists (
      select 1 from public.subscriptions s
      where s.id = payments.subscription_id and s.guardian_id = auth.uid()
    )
    or exists (
      select 1 from public.family_groups fg
      where fg.id = payments.family_group_id and fg.owner_id = auth.uid()
    )
  );

create policy "payments_admin_select"
  on public.payments for select
  using (exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and profiles.role = 'admin'
  ));

alter table public.notifications enable row level security;

grant select, update on public.notifications to authenticated;

create policy "notifications_select_own"
  on public.notifications for select
  using (user_id = auth.uid());

create policy "notifications_update_own"
  on public.notifications for update
  using (user_id = auth.uid());
