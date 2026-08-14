-- MakerStudio 마이그레이션 0003 — 회원가입 시 프로필 자동 생성 트리거
-- 짝 문서: Auth_Flow.md §2.1/2.3, 2026-08-14 발견된 버그 수정
--
-- 문제: auth.users 생성(1단계)과 profiles 생성(2단계)이 별개의 API 호출로 나뉘어 있어서,
-- 1단계는 성공하고 2단계가 실패하면 "로그인은 되는데 프로필이 없는" 반쪽짜리 계정이 생길 수 있었다.
-- (실사용자 테스트 중 실제로 발생 — profiles 테이블에 행이 없는데 로그인은 되는 계정 확인됨)
--
-- 해결: auth.users에 새 행이 생기면, DB가 트리거로 즉시 profiles 행도 만든다.
-- 이러면 두 단계가 사실상 하나의 원자적 동작이 되어 "반쪽 성공" 자체가 불가능해진다.

-- nickname을 NULL 허용으로 변경 — 트리거가 메타데이터 없이 프로필을 만들 때(예: 소셜 로그인
-- 최초 가입) nickname을 비워둔 채로 만들어야, 기존 "닉네임 없으면 최초 온보딩" 판단 로직
-- (app/api/identity/me/route.ts)이 계속 정확하게 작동한다. 기존 CHECK 제약(길이 10자 이하)은
-- Postgres에서 NULL 값에 대해 자동으로 통과되므로 별도 수정 없이 그대로 유지된다.
alter table public.profiles alter column nickname drop not null;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, role, nickname)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'role', 'student_teen'),
    new.raw_user_meta_data->>'nickname'  -- 메타데이터에 없으면 NULL로 남김 (온보딩 필요 표시)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

comment on function public.handle_new_user() is
  '2026-08-14: auth.users 생성과 profiles 생성을 원자적으로 묶는 트리거. 회원가입 라우트가
   더 이상 직접 profiles를 insert하지 않고, createUser() 호출 시 user_metadata로
   role/nickname을 넘기면 이 트리거가 알아서 처리한다.';
