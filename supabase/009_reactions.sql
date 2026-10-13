-- Run once in the Supabase SQL Editor, AFTER schema.sql.
-- Lets signed-in members react to summaries with one tap (like, love, clap,
-- insight, great read).
--   * Only signed-in members can see and add reactions.
--   * You can only react as yourself, once per reaction type per summary.
--   * Tapping a reaction again removes it.

create table if not exists public.reactions (
  summary_id uuid not null references public.summaries (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('like', 'love', 'clap', 'insight', 'book')),
  created_at timestamptz not null default now(),
  primary key (summary_id, user_id, kind)
);

create index if not exists reactions_summary_idx on public.reactions (summary_id);

alter table public.reactions enable row level security;

drop policy if exists "Members see reactions" on public.reactions;
create policy "Members see reactions"
  on public.reactions for select
  to authenticated
  using (true);

drop policy if exists "Members add own reactions" on public.reactions;
create policy "Members add own reactions"
  on public.reactions for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Members remove own reactions" on public.reactions;
create policy "Members remove own reactions"
  on public.reactions for delete
  to authenticated
  using (auth.uid() = user_id);

revoke update on public.reactions from anon, authenticated;
