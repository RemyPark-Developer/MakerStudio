-- 0032_content_modules_slug_versioning.sql
-- §6.3-a "이미 학습 중이던 사용자" 버전 고정 정책의 실제 구현 — content_modules에 이미
-- 있던 version 컬럼(0010)은 id가 PK라 같은 콘텐츠를 두 행으로 가질 방법이 없어 사실상
-- 죽어 있었다. slug를 버전 무관 식별자로 새로 두고, id는 버전별 기술적 키로 분리한다.
--
-- 기존 행은 slug = id로 백필(지금까지는 한 콘텐츠 = 한 행이라 id가 곧 slug였음) —
-- 기존 URL(/examples/{id})과 learning_progress.module_id는 그대로 유효하다.
-- 새 개선판(v2 이상)은 id = '{slug}-v{version}'로 새로 발급하고 slug는 그대로 유지해서,
-- 같은 slug로 여러 버전이 동시에 published일 수 있게 한다(2026-08-21).

alter table public.content_modules add column slug text;

update public.content_modules set slug = id where slug is null;

alter table public.content_modules alter column slug set not null;

alter table public.content_modules
  add constraint content_modules_slug_version_unique unique (slug, version);

create index if not exists idx_content_modules_slug on public.content_modules(slug);

comment on column public.content_modules.slug is
  '버전과 무관하게 콘텐츠를 식별하는 안정적인 키(URL, learning_progress.module_id가 참조).
   기존 행은 slug=id로 백필됨. 개선판(v2+)은 새 id(예: slug-v2)를 받지만 slug는 유지 —
   두 버전이 동시에 status=published일 수 있다(lib/content/publishedModules.ts의
   getPublishedModuleForUser()가 슬러그+진도 기록으로 어느 버전을 보여줄지 읽기 시점에 결정).';
