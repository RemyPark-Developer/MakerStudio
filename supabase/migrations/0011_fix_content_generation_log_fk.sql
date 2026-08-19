-- 0011_fix_content_generation_log_fk.sql

alter table public.content_generation_log
  drop constraint if exists content_generation_log_module_id_fkey;