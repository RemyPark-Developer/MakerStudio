-- 0014_family_groups.sql
-- Family 요금제(최대 3명, ₩19,900/월)를 위한 구독 그룹 구조.
-- ⚠️ guardian_child_links(법적 보호자-자녀 관계의 source of truth)는 절대 건드리지 않는다.
-- family_group_members에 아이를 추가하는 서버 로직은 반드시 guardian_child_links를
-- 먼저 확인해야 한다 (app/api/billing/family/members/route.ts).

create table public.family_groups (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  plan_tier text not null default 'family' check (plan_tier in ('family')),
  seat_limit int not null default 3 check (seat_limit = 3), -- 이번 범위: 좌석 추가 기능 없음, 항상 3 고정
  status text not null default 'active' check (status in ('active', 'canceled')),
  current_period_start timestamptz not null default now(),
  current_period_end timestamptz not null,
  canceled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id) -- 보호자당 family_group 1개. 결제 검증(verify)과 웹훅이 같은 결제를
                     -- 중복 처리해도 owner_id 기준 upsert라 자연히 멱등적이다.
);
comment on table public.family_groups is 'Family 요금제 구독 그룹. payments/subscriptions 테이블과는 분리되어 있어 이번 범위에서는 결제내역·환불 화면에 반영되지 않는다 (2026-08-20 결정).';

create table public.family_group_members (
  family_group_id uuid not null references public.family_groups(id) on delete cascade,
  child_id uuid not null references public.profiles(id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (family_group_id, child_id),
  unique (child_id) -- 한 아이는 동시에 하나의 family_group에만 속함
);
comment on table public.family_group_members is '멤버십 테이블. 여기 추가하기 전에 반드시 guardian_child_links로 법적 보호자 관계를 서버에서 재확인할 것 — 이 테이블 자체는 그 검증을 강제하지 않는다.';

create index idx_family_group_members_group on public.family_group_members(family_group_id);

alter table public.family_groups enable row level security;
alter table public.family_group_members enable row level security;

-- SELECT만 허용(owner 본인). INSERT/UPDATE/DELETE 정책은 의도적으로 만들지 않는다 —
-- 멤버십 변경은 반드시 서버(guardian_child_links 검증 게이트)를 거쳐야 하고, 이 정책이
-- 없으면 클라이언트 키로 직접 쓰기를 시도해도 RLS가 막는다(실제 서버 코드는 service_role로
-- RLS를 우회하지만, 이건 "혹시 나중에 클라이언트가 직접 접근하게 되더라도" 대비한 안전장치).
create policy "family_groups_owner_select"
  on public.family_groups for select
  using (owner_id = auth.uid());

create policy "family_group_members_owner_select"
  on public.family_group_members for select
  using (exists (
    select 1 from public.family_groups fg
    where fg.id = family_group_members.family_group_id and fg.owner_id = auth.uid()
  ));
