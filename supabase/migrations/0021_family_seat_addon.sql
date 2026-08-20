-- 0021_family_seat_addon.sql
-- Family 좌석 추가(4번째부터) 기능(2026-08-20 설계)을 위한 선행 작업.
--
-- 0014에서 family_groups.seat_limit을 3으로 고정했었다(check (seat_limit = 3)) — 이번에
-- 좌석 추가 결제로 일시적으로 seat_limit을 늘릴 수 있게 제약을 완화한다. 3~6 범위로 제한:
-- 기본 3 + 최대 3개 추가 좌석(₩4,900 x 3, 2026-08-18 확정 가격)까지만 허용.
--
-- 좌석 추가는 "그 결제 주기 동안만 유효" — activateFamilyGroup()이 Family 요금제
-- 재결제 때마다 seat_limit을 다시 3으로 upsert하므로 다음 주기엔 자동으로 리셋된다
-- (lib/billing/activateFamilyGroup.ts 참고, 별도 만료 처리 불필요).

-- ⚠️ 제약 이름을 하드코딩하지 않고 동적으로 찾아서 드롭한다 — 0018에서 이름을
-- 추측했다가 틀려서 마이그레이션이 절반만 실행된 적이 있어서(교훈: memory
-- project_notifications_domain.md §7), 이 프로젝트에선 이 패턴을 기본으로 쓴다.
do $$
declare
  existing_constraint text;
begin
  select con.conname into existing_constraint
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace nsp on nsp.oid = rel.relnamespace
  where nsp.nspname = 'public'
    and rel.relname = 'family_groups'
    and con.contype = 'c'
    and pg_get_constraintdef(con.oid) like '%seat_limit%'
  limit 1;

  if existing_constraint is not null then
    execute format('alter table public.family_groups drop constraint %I', existing_constraint);
  end if;

  alter table public.family_groups add constraint family_groups_seat_limit_check
    check (seat_limit between 3 and 6);
end $$;

comment on column public.family_groups.seat_limit is '기본 3, 좌석 추가 결제(family_extra_seat, ₩4,900/좌석)로 최대 6까지 임시로 늘어날 수 있다. Family 요금제 재결제 시 activateFamilyGroup()이 항상 3으로 리셋한다 — "그 결제 주기 동안만 유효"가 이 리셋으로 자연히 성립한다.';
