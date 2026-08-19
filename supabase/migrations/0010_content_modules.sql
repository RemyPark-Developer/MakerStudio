-- 0010_content_modules.sql

create table if not exists public.content_modules (
  id text primary key,                    -- 예: 'ultrasonic'
  board text not null default 'uno',
  icon text,
  label_ko text not null,
  label_en text,
  difficulty int not null default 1,
  estimated_minutes int not null default 20,
  pin text,
  intro_ko text,
  intro_en text,
  parts jsonb not null default '[]',
  circuit jsonb not null default '{}',
  code text not null default '',
  explain_ko text,
  explain_en text,
  mission_ko text,
  mission_en text,
  quiz jsonb not null default '{}',
  source_example text,

  version int not null default 1,
  status text not null default 'draft'
    check (status in ('draft','pending_review','published','withdrawn','automation_stuck')),

  retry_count int not null default 0,
  last_error text,
  last_verified_at timestamptz,

  created_by uuid references auth.users(id),
  reviewed_by uuid references auth.users(id),
  review_note text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_content_modules_status on public.content_modules(status);

-- 생성/검증 시도 로그 (자동 재생성 루프 추적용)
create table if not exists public.content_generation_log (
  id uuid primary key default gen_random_uuid(),
  module_id text not null references public.content_modules(id) on delete cascade,
  attempt_number int not null,
  stage text not null check (stage in ('ai_generate','schema_validate','compile_validate')),
  passed boolean not null,
  detail text,
  created_at timestamptz not null default now()
);

create index if not exists idx_content_gen_log_module on public.content_generation_log(module_id);

-- RLS: content_modules는 관리자만 접근 (service role로만 쓰므로 RLS는 최소한으로,
-- 혹시 나중에 클라이언트에서 직접 조회할 경우를 대비해 PUBLISHED만 공개 read 허용)
alter table public.content_modules enable row level security;

create policy "content_modules_public_read_published"
  on public.content_modules for select
  using (status = 'published');