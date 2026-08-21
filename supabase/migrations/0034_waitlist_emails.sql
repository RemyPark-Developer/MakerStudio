-- 0034_waitlist_emails.sql
-- 가격 정책 페이지(/pricing) 하단 "출시 알림 신청"용. notifications 테이블은 user_id가
-- 필수 FK라 비로그인 방문자의 이메일을 담을 수 없어서 별도 테이블로 분리한다.
--
-- service_role 전용 — RLS/GRANT를 붙이지 않는다(tutor_usage/wishlist_items와 동일 패턴,
-- 클라이언트가 직접 조회/기록할 의도 자체가 없음. app/api/notifications/waitlist/route.ts만
-- service_role로 insert/upsert한다).

create table public.waitlist_emails (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  marketing_consent boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.waitlist_emails is
  '가격 정책 페이지(/pricing) "출시 알림 신청". service_role 전용 — 클라이언트 직접 접근
   의도 없음(tutor_usage/wishlist_items와 동일 패턴, RLS/GRANT 없음). marketing_consent는
   정보통신망법 제50조 마케팅 정보 수신 별도 동의 — 기본값 false, 사용자가 명시적으로
   체크해야만 true(다크패턴 금지 원칙 — 사전 체크된 옵션 없음).';
