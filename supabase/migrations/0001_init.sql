-- MakerStudio 초기 스키마 마이그레이션
-- 짝 문서: docs/MakerStudio_DB_Schema_v1.0.md
-- Supabase 프로젝트에 그대로 적용 가능 (auth.users는 Supabase가 이미 제공하므로 별도 생성하지 않음)

create extension if not exists "pgcrypto"; -- gen_random_uuid() 사용을 위해

-- ============================================================
-- identity 도메인
-- ============================================================

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('student_teen','student_child','guardian','admin')),
  nickname text not null check (char_length(nickname) <= 10),
  avatar text,
  created_at timestamptz not null default now(),
  deleted_at timestamptz -- 소프트 삭제 (§4.5: payments는 별도 보존이라 하드 삭제 안 함)
);
comment on table public.profiles is 'auth.users를 확장하는 서비스 고유 프로필 (Supabase 표준 패턴, DB_Schema.md §0.1)';

create table public.guardian_child_links (
  id uuid primary key default gen_random_uuid(),
  guardian_id uuid not null references public.profiles(id) on delete cascade,
  child_id uuid not null references public.profiles(id) on delete cascade,
  consent_verified_at timestamptz not null,
  consent_method text not null default 'sms' check (consent_method in ('sms')),
  unique (guardian_id, child_id)
);
comment on table public.guardian_child_links is '§3.2 법정대리인 동의 기록 — consent_verified_at은 감사 로그 목적으로 절대 null 불가';

create table public.password_reset_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  token text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz
);

-- ============================================================
-- billing 도메인
-- ============================================================

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  guardian_id uuid not null references public.profiles(id),
  child_id uuid not null references public.profiles(id),
  plan text not null check (plan in ('free','premium')),
  status text not null check (status in ('active','canceled','past_due')),
  current_period_start timestamptz not null,
  current_period_end timestamptz not null,
  canceled_at timestamptz
);
comment on table public.subscriptions is 'guardian_id만 결제 주체 — API 미들웨어+RLS 이중 검증 (Auth_Flow.md §3)';

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.subscriptions(id),
  amount integer not null check (amount >= 0),
  status text not null check (status in ('success','failed','refunded')),
  pg_transaction_id text,
  paid_at timestamptz not null default now()
);
comment on table public.payments is '§4.5: 사용자가 소프트 삭제되어도 이 테이블은 보존 (전자상거래법 거래기록 보존의무)';

-- ============================================================
-- content 도메인
-- ============================================================

create table public.examples (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  label jsonb not null,        -- {"ko": "...", "en": "..."} — §6.2 다국어 대비
  board text not null,
  difficulty smallint not null check (difficulty between 1 and 5),
  estimated_minutes smallint not null,
  pin text not null,
  intro jsonb not null,
  parts jsonb not null,        -- 문자열 배열
  code text not null,
  explain jsonb not null,
  mission jsonb not null,
  quiz jsonb not null,         -- {question, options, answer, explain}
  status text not null default 'draft' check (status in ('draft','pending_review','published','withdrawn')),
  version integer not null default 1,
  source_example text,
  last_verified_at timestamptz,
  is_premium boolean not null default false,
  created_at timestamptz not null default now()
);
comment on table public.examples is '§7.2: is_premium=true인 행의 code/explain은 미구독자에게 API 레이어에서 반드시 제외';

-- ============================================================
-- learning 도메인
-- ============================================================

create table public.progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  example_id uuid not null references public.examples(id),
  step smallint not null default 0,
  updated_at timestamptz not null default now(),
  unique (user_id, example_id)
);

create table public.saved_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  example_id uuid not null references public.examples(id),
  code text not null,
  saved_at timestamptz not null default now()
);

create table public.wishlist_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kit_id text not null,
  created_at timestamptz not null default now(),
  unique (user_id, kit_id)
);
comment on table public.wishlist_items is 'Could 항목(MVP_Scope.md) — 협상 결과 제외되면 이 테이블 자체를 마이그레이션에서 뺄 것';

create table public.tutor_usage (
  user_id uuid not null references public.profiles(id) on delete cascade,
  usage_date date not null,
  count smallint not null default 0,
  primary key (user_id, usage_date)
);
comment on table public.tutor_usage is 'lib/rate-limit.ts의 인메모리 카운터를 대체하는 DB 버전 (§5.2에 명시된 전환 지점)';

-- ============================================================
-- notifications 도메인
-- ============================================================

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  message text not null,
  action_url text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

-- ============================================================
-- 인덱스 (자주 조회되는 조합 기준)
-- ============================================================

create index idx_progress_user on public.progress(user_id);
create index idx_saved_codes_user on public.saved_codes(user_id);
create index idx_notifications_user_unread on public.notifications(user_id) where read_at is null;
create index idx_examples_status on public.examples(status) where status = 'published';
create index idx_subscriptions_guardian on public.subscriptions(guardian_id);
