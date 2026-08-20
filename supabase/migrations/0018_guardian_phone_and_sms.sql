-- 0018_guardian_phone_and_sms.sql
-- notifications 도메인 SMS 채널 추가(2026-08-20 설계)를 위한 선행 작업.
--
-- guardian 전화번호가 이 저장소 어디에도 저장되어 있지 않았다 — 초등학생 가입 때 쓰는
-- guardianPhone(lib/identity/childSignup.ts)은 SMS 인증에만 쓰고 버려지는 값이라 재사용
-- 불가. profiles.phone을 새로 만들고, app/api/identity/me + app/mypage/settings에서
-- 닉네임과 같은 방식으로 guardian이 직접 입력하게 한다.

-- if not exists — 재실행(retry) 안전하게. 처음 실행 시 이 문장 이후 구문이 실패해서
-- phone만 추가된 채 중단된 적이 있었다(2026-08-20, 제약 이름 추측이 틀렸던 게 원인).
alter table public.profiles add column if not exists phone text;

comment on column public.profiles.phone is 'guardian의 SMS 알림 수신 번호. 닉네임과 동일한 신뢰 수준(자가입력, 별도 소유 인증 없음). nullable — 없으면 notifications.delivery_status가 skipped로 기록되고 email만 감.';

-- SMS를 시도조차 못 한 경우(전화번호 없음)를 진짜 발송 실패(failed)와 구분하기 위해
-- delivery_status에 'skipped'를 추가한다.
-- ⚠️ 제약 이름을 하드코딩하지 않고 동적으로 찾아서 드롭한다 — 0016이 실제로 어떤 이름을
-- 붙였는지 마이그레이션 파일만 보고는 100% 확신할 수 없었고, 실제로 추측이 틀려서 이
-- 문장이 처음에 실패했다. pg_constraint에서 delivery_status를 검사하는 check 제약을
-- 찾아 그 이름 그대로 드롭하면 이름 추측 문제 자체가 사라진다.
do $$
declare
  existing_constraint text;
begin
  select con.conname into existing_constraint
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace nsp on nsp.oid = rel.relnamespace
  where nsp.nspname = 'public'
    and rel.relname = 'notifications'
    and con.contype = 'c'
    and pg_get_constraintdef(con.oid) like '%delivery_status%'
  limit 1;

  if existing_constraint is not null then
    execute format('alter table public.notifications drop constraint %I', existing_constraint);
  end if;

  -- 이미 skipped까지 포함된 제약이 어떤 이름으로든 남아있을 수 있으니(재실행 대비)
  -- 매번 위에서 지우고 여기서 고정된 이름으로 다시 만든다.
  alter table public.notifications add constraint notifications_delivery_status_check
    check (delivery_status in ('pending', 'sent', 'failed', 'skipped'));
end $$;
