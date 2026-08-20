-- 0020_add_family_member_seat_lock.sql
-- Family 좌석초과 동시성 방어(2026-08-20 설계).
--
-- app/api/billing/family/members/route.ts의 POST는 "현재 멤버 수 확인 → 판단 → insert"가
-- 서로 다른 단계로 나뉘어 있어서, 서로 다른 자녀 2명을 동시에 추가하는 요청이 겹치면 둘 다
-- "자리 있음"으로 판단하고 둘 다 성공해 정원(3명)을 넘길 수 있었다. increment_tutor_usage(0002),
-- submit_quiz_attempt(0008/0009)와 같은 패턴 — family_groups row를 for update로 잠가서
-- 같은 그룹에 대한 동시 추가 요청을 직렬화한다.
--
-- 같은 아이를 두 번 동시에 추가하는 레이스는 family_group_members.child_id의 unique 제약
-- (0014)이 이미 막고 있어서 이 함수가 새로 신경 쓸 필요 없다 — 여기서 막는 건 서로 다른
-- 아이 여러 명이 동시에 들어와 정원을 넘기는 경우뿐이다.

create or replace function public.add_family_member(
  p_family_group_id uuid,
  p_child_id uuid
)
returns table(ok boolean, reason text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_seat_limit int;
  v_count int;
begin
  select status, seat_limit into v_status, v_seat_limit
  from family_groups where id = p_family_group_id for update;

  if v_status is null or v_status <> 'active' then
    return query select false, 'no_active_family_plan';
    return;
  end if;

  if exists (select 1 from family_group_members where child_id = p_child_id) then
    return query select false, 'already_member';
    return;
  end if;

  select count(*) into v_count from family_group_members where family_group_id = p_family_group_id;
  if v_count >= v_seat_limit then
    return query select false, 'seat_limit_reached';
    return;
  end if;

  insert into family_group_members (family_group_id, child_id) values (p_family_group_id, p_child_id);
  return query select true, null::text;
end;
$$;

revoke all on function public.add_family_member(uuid, uuid) from public, anon, authenticated;
