-- 0035_vip_mentor_program.sql
-- Premium VIP 요금제(월 ₩100,000) — "AI 초안 + 사람(대표) 승인 후 발송" 비동기 멘토링.
-- 절대 AI가 사람인 척 전부 처리하지 않는다(표시광고법 허위광고 리스크 + 이 프로젝트의
-- 정직성 원칙) — 반드시 admin이 검토·수정한 뒤에만 학생/보호자에게 전달된다.

-- 1) subscriptions.plan에 premium_vip 허용 — 제약 이름을 하드코딩하지 않고 동적으로 찾아
-- 드롭한다(0018_guardian_phone_and_sms.sql에서 확립한 패턴 — 이름 추측이 틀리면 이 문장만
-- 실패하고 뒤가 안 실행되는 사고가 난 적이 있어서, 그 이후 이 저장소의 기본 패턴이 됨).
do $$
declare
  existing_constraint text;
begin
  select con.conname into existing_constraint
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace nsp on nsp.oid = rel.relnamespace
  where nsp.nspname = 'public'
    and rel.relname = 'subscriptions'
    and con.contype = 'c'
    and pg_get_constraintdef(con.oid) like '%plan%'
  limit 1;

  if existing_constraint is not null then
    execute format('alter table public.subscriptions drop constraint %I', existing_constraint);
  end if;

  alter table public.subscriptions add constraint subscriptions_plan_check
    check (plan in ('free', 'premium', 'premium_vip'));
end $$;

-- 2) VIP 멘토링 제출/검수 테이블 — 한 제출 건(status 상태기계 + AI초안 + 최종본)을 한 행에
-- 담는다. content_review_messages(관리자-AI 대화 로그, 여러 행)와는 구조가 달라서 그대로
-- 재사용하지 않았고, content_modules(단일 행에 상태·본문을 같이 담는 구조)에 더 가깝다.
create table public.vip_mentor_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade, -- 제출한 학생
  submission_content text not null check (char_length(submission_content) <= 8000),
  ai_draft_feedback text,
  final_feedback text,
  status text not null default 'submitted'
    check (status in ('submitted', 'ai_drafted', 'approved', 'sent')),
  flagged boolean not null default false,
  flag_reason text,
  reviewed_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

comment on table public.vip_mentor_requests is
  'Premium VIP(월 ₩100,000) 비동기 멘토링. AI가 ai_draft_feedback을 초안으로 쓰고,
   admin이 검토·수정한 뒤에만 final_feedback으로 확정 + status=sent + 학생/보호자 알림
   (app/api/learning/vip/admin/[id]/approve-and-send). AI 단독 발송 절대 금지 — 이 프로젝트의
   정직성 원칙 및 표시광고법 위반 방지.';

comment on column public.vip_mentor_requests.flagged is
  'lib/learning/tutorSafety.ts의 checkInputSafety() 필터에 걸렸었는지(tutor_messages와
   동일 패턴) — 걸리면 submission_content엔 원문이 아니라 redactedText가 저장된다.';

create index idx_vip_mentor_requests_user on public.vip_mentor_requests(user_id, created_at);
create index idx_vip_mentor_requests_status on public.vip_mentor_requests(status);

-- 실제 사용자 생성 콘텐츠(학생이 제출한 프로젝트/코드)를 담는 테이블이라 tutor_messages/
-- learning_progress와 동일하게 RLS+GRANT를 세트로 건다(단순 카운터인 tutor_usage/
-- waitlist_emails와는 다른 부류 — 이 세션 내내 지켜온 구분 원칙).
alter table public.vip_mentor_requests enable row level security;

grant select on public.vip_mentor_requests to authenticated;

create policy "vip_mentor_requests_own_select"
  on public.vip_mentor_requests for select
  using (user_id = auth.uid());

create policy "vip_mentor_requests_admin_select"
  on public.vip_mentor_requests for select
  using (exists (
    select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin'
  ));

-- 쓰기는 전부 service_role(API 라우트)에서만 — insert/update 정책 없음(기존 컨벤션과 동일,
-- 이 저장소엔 브라우저가 Supabase에 직접 붙는 경로가 없음). guardian이 자녀 것을 보는
-- 경로는 RLS로 안 되므로(guardian != 제출자) app/api/learning/vip/my-requests가
-- guardian_child_links로 관계를 먼저 확인한 뒤 service_role로 조회해서 내려준다.
