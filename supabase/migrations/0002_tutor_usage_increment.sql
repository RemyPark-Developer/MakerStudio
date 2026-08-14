-- MakerStudio 마이그레이션 0002 — AI 튜터 사용량 원자적 증가 함수
-- 짝 문서: Design.md §5.2 (rate-limit user_id 전환 지점), 2026-08-13 로그인 필수 전환 결정

-- 왜 RPC 함수로 만들었나: 클라이언트에서 "읽고 → 확인하고 → 쓰는" 3단계로 구현하면
-- 동시에 두 요청이 오는 경우(연타, 여러 탭) 카운트가 씹혀서 실제 한도보다 더 많이 허용될 수 있다.
-- 이 함수는 하나의 트랜잭션 + 행 잠금(for update)으로 묶어서 원자적으로 처리한다.

create or replace function public.increment_tutor_usage(p_user_id uuid, p_limit int)
returns table(allowed boolean, remaining int)
language plpgsql
as $$
declare
  v_today date := current_date;
  v_count int;
begin
  insert into public.tutor_usage (user_id, usage_date, count)
  values (p_user_id, v_today, 0)
  on conflict (user_id, usage_date) do nothing;

  select count into v_count
  from public.tutor_usage
  where user_id = p_user_id and usage_date = v_today
  for update;

  if v_count >= p_limit then
    return query select false, 0;
  else
    update public.tutor_usage
    set count = count + 1
    where user_id = p_user_id and usage_date = v_today;
    return query select true, (p_limit - v_count - 1);
  end if;
end;
$$;

comment on function public.increment_tutor_usage is
  '§5.2 rate-limit user_id 전환 구현. 원자적 증가로 동시요청 경쟁조건 방지.';
