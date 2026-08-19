-- 0008_learning_progress.sql

create table if not exists public.learning_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  module_id text not null,
  board text not null default 'uno',
  status text not null default 'in_progress' check (status in ('in_progress','completed')),
  quiz_passed boolean not null default false,
  quiz_score numeric,
  quiz_attempts_count int not null default 0,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (user_id, module_id)
);

create index if not exists idx_learning_progress_user on public.learning_progress(user_id);

alter table public.learning_progress enable row level security;

create policy "learning_progress_select_own"
  on public.learning_progress for select
  using (auth.uid() = user_id);

create policy "learning_progress_insert_own"
  on public.learning_progress for insert
  with check (auth.uid() = user_id);

create policy "learning_progress_update_own"
  on public.learning_progress for update
  using (auth.uid() = user_id);

-- 퀴즈 시도 로그 (append-only)
create table if not exists public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  module_id text not null,
  score numeric not null,
  passed boolean not null,
  answers jsonb,
  attempted_at timestamptz not null default now()
);

create index if not exists idx_quiz_attempts_user_module on public.quiz_attempts(user_id, module_id);

alter table public.quiz_attempts enable row level security;

create policy "quiz_attempts_select_own"
  on public.quiz_attempts for select
  using (auth.uid() = user_id);

create policy "quiz_attempts_insert_own"
  on public.quiz_attempts for insert
  with check (auth.uid() = user_id);

-- atomic RPC: 퀴즈 제출 + 진도 갱신을 한 트랜잭션으로
create or replace function public.submit_quiz_attempt(
  p_module_id text,
  p_score numeric,
  p_passed boolean,
  p_answers jsonb,
  p_pass_threshold numeric default 70
)
returns table (
  attempt_id uuid,
  progress_status text,
  quiz_passed boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_attempt_id uuid;
begin
  if v_user_id is null then
    raise exception 'not_authenticated';
  end if;

  insert into quiz_attempts (user_id, module_id, score, passed, answers)
  values (v_user_id, p_module_id, p_score, p_passed, p_answers)
  returning id into v_attempt_id;

  insert into learning_progress (user_id, module_id, status, quiz_passed, quiz_score, quiz_attempts_count, completed_at)
  values (
    v_user_id, p_module_id,
    case when p_passed then 'completed' else 'in_progress' end,
    p_passed, p_score, 1,
    case when p_passed then now() else null end
  )
  on conflict (user_id, module_id) do update
    set quiz_attempts_count = learning_progress.quiz_attempts_count + 1,
        quiz_score = p_score,
        quiz_passed = learning_progress.quiz_passed or p_passed,
        status = case when learning_progress.quiz_passed or p_passed then 'completed' else learning_progress.status end,
        completed_at = case when (learning_progress.quiz_passed or p_passed) and learning_progress.completed_at is null then now() else learning_progress.completed_at end,
        updated_at = now();

  return query
    select v_attempt_id, lp.status, lp.quiz_passed
    from learning_progress lp
    where lp.user_id = v_user_id and lp.module_id = p_module_id;
end;
$$;

revoke all on function public.submit_quiz_attempt from public;
grant execute on function public.submit_quiz_attempt to authenticated;