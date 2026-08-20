-- 0019_drop_dead_guardian_id_column.sql
-- profiles.guardian_id 컬럼 제거 (2026-08-20 스키마 드리프트 전수조사 중 발견)
--
-- 이 컬럼은 0007_add_guardian_id.sql(2026-08-19, 커밋 2b16a05)에서 추가됐지만, 실제 보호자-자녀
-- 관계는 처음부터 끝까지 guardian_child_links(0001_init.sql)로만 처리되고 있었다 — 심지어
-- guardian_id를 추가한 바로 그 커밋조차 실제 연결 로직은 guardian_child_links에 insert하는
-- 방식으로 구현했다(app/api/identity/signup/child/verify/route.ts). 앱 코드 전체(app/, lib/)를
-- 재확인해도 profiles.guardian_id를 읽거나 쓰는 곳이 없고, Zod 스키마나 타입 정의에도 없다.
-- 실제 계정 6개 전부 이 컬럼 값이 null이었다.
--
-- 지금 제거하는 이유: 이 컬럼엔 on delete cascade가 걸려 있어서, 나중에 누군가 실수로(또는
-- "이미 있는 컬럼이니까"라는 이유로) 여기에 값을 채우기 시작하면 "보호자 계정 삭제 시 자녀
-- 프로필까지 연쇄 삭제"라는 위험한 부작용이 생긴다. 안 쓰는 지금 없애는 게 안전하다.
--
-- 참고: idx_profiles_guardian_id 인덱스는 컬럼을 드롭하면 Postgres가 자동으로 같이 지운다 —
-- 별도 DROP INDEX 문 불필요.

alter table public.profiles drop column if exists guardian_id;
