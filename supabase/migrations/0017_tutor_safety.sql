-- 0017_tutor_safety.sql
-- AI 튜터 아동 안전장치(2026-08-20 설계). tutor_messages에 필터링 결과를 기록할 컬럼을
-- 추가한다. student_child가 AI 튜터와 직접 대화하는데 지금까지 입력/출력 어느 쪽에도
-- 코드 레벨 필터가 없었다 — 이 마이그레이션은 lib/learning/tutorSafety.ts가 감지한
-- 욕설/개인정보(PII) 결과를 저장하기 위한 것.

alter table public.tutor_messages
  add column flagged boolean not null default false,
  add column flag_reason text;

comment on column public.tutor_messages.flagged is '욕설/개인정보(PII) 등 안전 필터에 걸렸는지. true면 content는 원문이 아니라 치환(redact)된 텍스트다.';
comment on column public.tutor_messages.flag_reason is '지금 쓰는 값: profanity, pii. check 제약을 걸지 않은 이유 — 나중에 off_topic_refusal 같은 관찰용 값을 추가해도 마이그레이션이 필요 없게 하기 위함.';
