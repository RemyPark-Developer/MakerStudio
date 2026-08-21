-- 0026_debug_list_policies.sql
-- pg_policies는 PostgREST가 REST로 노출하지 않아(pg_catalog), 지금까지 RLS 정책 존재
-- 여부를 "정책이 있어야만 나올 수 있는 동작"으로 간접 실증해왔다(2026-08-21,
-- 0022~0025 검증 과정). 이 진단용 RPC는 그걸 직접 조회할 수 있게 한다 —
-- service_role 전용, public/anon/authenticated에는 실행 권한을 주지 않는다.

create or replace function public.debug_list_policies()
returns table(
  tablename text,
  policyname text,
  cmd text,
  roles text[],
  qual text,
  with_check text
)
language sql
security definer
set search_path = public
as $$
  select tablename, policyname, cmd, roles, qual, with_check
  from pg_policies
  where schemaname = 'public'
  order by tablename, policyname;
$$;

revoke all on function public.debug_list_policies() from public;
grant execute on function public.debug_list_policies() to service_role;
