-- 0037_content_stats.sql
-- 콘텐츠 통계 기능(조회수·평점·최근 활동자 수) — 유일한 신규 테이블은 content_ratings.
-- 조회수·최근 활동자 수는 learning_progress에서 집계하는 뷰로만 구현(새 테이블 없음).

create table public.content_ratings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- learning_progress.module_id와 동일 관례(슬러그, FK 없음) — draft 콘텐츠도 평가 가능해야
  -- 하므로 tutor_messages/content_review_messages와 같은 이유로 느슨하게 참조만 함.
  module_id text not null,
  rating smallint not null check (rating between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, module_id)
);

create index idx_content_ratings_module on public.content_ratings(module_id);

alter table public.content_ratings enable row level security;

-- 본인 평점만 쓰기 가능
create policy "content_ratings_upsert_own"
  on public.content_ratings for insert
  with check (auth.uid() = user_id);

create policy "content_ratings_update_own"
  on public.content_ratings for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 개별 평점은 본인/admin만 읽기 가능 (집계 결과는 아래 뷰로 별도 공개)
create policy "content_ratings_select_own"
  on public.content_ratings for select
  using (auth.uid() = user_id);

create policy "content_ratings_select_admin"
  on public.content_ratings for select
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- ⚠️ 이 프로젝트는 anon/authenticated에 기본 GRANT가 없어서 정책만 만들면 본인조차
-- 42501로 막힌다 — 정책과 GRANT를 항상 세트로 만들 것 (CLAUDE.md 절대 규칙).
grant select, insert, update on public.content_ratings to authenticated;

-- ── 집계 뷰 3개 — 개별 사용자 행이 아니라 익명 집계 수치만 노출하므로, 0033 billing 뷰와
-- 달리 anon/authenticated에 GRANT해도 안전하다(공개 콘텐츠 카드가 직접 조회함).

-- 조회수(=퀴즈 응시 고유 사용자 수). 새 테이블 없이 learning_progress만 사용.
create or replace view public.content_view_counts as
select module_id, count(distinct user_id) as view_count
from public.learning_progress
group by module_id;

-- 평점 집계 — 개별 사용자의 평점(누가 몇 점을 줬는지)은 이 뷰에 없음.
create or replace view public.content_rating_summary as
select module_id, round(avg(rating)::numeric, 2) as avg_rating, count(*) as rating_count
from public.content_ratings
group by module_id;

-- 최근 5분 활동자 수(근사치 — 진짜 실시간 presence 아님, 이번 범위 밖).
create or replace view public.content_recent_activity as
select module_id, count(distinct user_id) as recent_active_count
from public.learning_progress
where updated_at >= now() - interval '5 minutes'
group by module_id;

grant select on public.content_view_counts to anon, authenticated;
grant select on public.content_rating_summary to anon, authenticated;
grant select on public.content_recent_activity to anon, authenticated;
