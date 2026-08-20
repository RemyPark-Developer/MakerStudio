-- 0016_notification_delivery.sql
-- notifications 테이블(0001_init.sql부터 존재, 인앱 알림 레코드)에 외부 채널(이메일/SMS)
-- 발송 여부·성공 여부를 기록할 컬럼을 추가한다.
--
-- 지금까지 이 테이블에는 아무 코드도 insert하지 않고 있었다(스키마만 있고 프로듀서 없음).
-- 이번 변경으로 billing/family 도메인의 이벤트(결제 성공/실패, 구독 해지, Family 멤버
-- 추가/제거)가 실제로 이 테이블에 기록되고, 동시에 Resend로 이메일 발송을 시도한다
-- (2026-08-20 notifications 도메인 설계). SMS는 guardian 연락처가 DB에 영구 저장되지
-- 않아서 이번 범위에서 제외 — channel 컬럼은 나중에 값만 바꿔 끼울 수 있게 미리 마련.

alter table public.notifications
  add column channel text not null default 'email' check (channel in ('email', 'sms')),
  add column delivery_status text not null default 'pending' check (delivery_status in ('pending', 'sent', 'failed')),
  add column delivered_at timestamptz;

comment on column public.notifications.channel is '이 알림을 어떤 외부 채널로 발송 시도했는지. 지금은 항상 email(SMS는 guardian 연락처 미보유로 보류).';
comment on column public.notifications.delivery_status is '외부 채널 발송 성공 여부. 실패해도 이 row(인앱 알림) 자체는 남아있다 — 발송 실패가 도메인 로직(예: 결제 활성화) 성공을 되돌리지 않는다.';
