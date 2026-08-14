-- MakerStudio 마이그레이션 0005 — subscriptions 테이블에 (guardian_id, child_id) 유니크 제약 추가
-- 2026-08-14, 결제(§5단계) 구현 중 발견
--
-- 배경: 한 자녀당 구독은 "하나의 행을 계속 갱신"하는 모델로 설계했다(재구독해도 새 행을
-- 만들지 않고 기존 행의 status/기간을 갱신). checkout/verify/route.ts가 이 가정으로
-- upsert(onConflict: "guardian_id,child_id")를 쓰는데, 정작 그 조합에 유니크 제약이
-- 없어서 실제로는 동작하지 않았을 것 — 로컬 Postgres로 검증하며 발견해서 지금 추가한다.

alter table public.subscriptions
  add constraint subscriptions_guardian_child_unique unique (guardian_id, child_id);
