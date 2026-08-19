-- 0012_tutor_messages.sql

create table if not exists public.tutor_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  example_id text not null,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_tutor_messages_user_example
  on public.tutor_messages(user_id, example_id, created_at);

alter table public.tutor_messages enable row level security;

create policy "tutor_messages_select_own"
  on public.tutor_messages for select
  using (auth.uid() = user_id);

-- insert는 서버(service role)에서만 하므로 클라이언트용 insert 정책은 만들지 않음