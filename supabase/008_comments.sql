-- Run once in the Supabase SQL Editor, AFTER schema.sql and 002_admin_books.sql.
-- Lets signed-in members comment on each other's summaries.
--   * Only signed-in members can read and write comments.
--   * You can only post as yourself.
--   * You can delete your own comments; the superadmin can delete any.
--   * Comments cannot be edited.

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  summary_id uuid not null references public.summaries (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 1000),
  created_at timestamptz not null default now()
);

create index if not exists comments_summary_idx on public.comments (summary_id, created_at);

alter table public.comments enable row level security;

drop policy if exists "Members read comments" on public.comments;
create policy "Members read comments"
  on public.comments for select
  to authenticated
  using (true);

drop policy if exists "Members post own comments" on public.comments;
create policy "Members post own comments"
  on public.comments for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Delete own comment or superadmin" on public.comments;
create policy "Delete own comment or superadmin"
  on public.comments for delete
  to authenticated
  using (auth.uid() = user_id or public.is_superadmin());

-- No edits: nobody can change a comment after it is posted.
revoke update on public.comments from anon, authenticated;
