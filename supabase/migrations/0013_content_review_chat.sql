-- 0013_content_review_chat.sql

create table if not exists public.content_review_messages (
  id uuid primary key default gen_random_uuid(),
  module_id text not null,  -- FK 없음: draft 단계에서도 리뷰 가능해야 하므로 tutor_messages와 같은 이유로 느슨하게
  admin_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('admin', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_content_review_messages_module
  on public.content_review_messages(module_id, created_at);

alter table public.content_review_messages enable row level security;

-- 관리자만 볼 수 있게 (profiles.role = 'admin' 체크)
create policy "content_review_messages_admin_only"
  on public.content_review_messages for select
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );