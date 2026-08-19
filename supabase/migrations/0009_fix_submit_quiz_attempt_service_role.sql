-- 0009_fix_submit_quiz_attempt_service_role.sql

create or replace function public.submit_quiz_attempt(
  p_user_id uuid,
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
  v_attempt_id uuid;
begin
  if p_user_id is null then
    raise exception 'user_id_required';
  end if;

  insert into quiz_attempts (user_id, module_id, score, passed, answers)
  values (p_user_id, p_module_id, p_score, p_passed, p_answers)
  returning id into v_attempt_id;

  insert into learning_progress (user_id, module_id, status, quiz_passed, quiz_score, quiz_attempts_count, completed_at)
  values (
    p_user_id, p_module_id,
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
    where lp.user_id = p_user_id and lp.module_id = p_module_id;
end;
$$;

-- service role만 호출하도록 잠금 (anon/authenticated 클라이언트에서 직접 호출 못 하게)
revoke all on function public.submit_quiz_attempt(uuid, text, numeric, boolean, jsonb, numeric) from public, anon, authenticated;