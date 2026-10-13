-- Run once in the Supabase SQL Editor, AFTER 008_comments.sql and 009_reactions.sql.
--
-- 1. One reaction per member per summary (tapping another emoji replaces it).
-- 2. A notification for the author whenever someone comments on their summary.
--    Reactions do not create notifications.

-- 1. One reaction per member per summary ----------------------------------
-- Keep only the newest reaction where a member already picked several.
delete from public.reactions r
using public.reactions newer
where r.summary_id = newer.summary_id
  and r.user_id = newer.user_id
  and (r.created_at, r.ctid) < (newer.created_at, newer.ctid);

alter table public.reactions drop constraint if exists reactions_pkey;
alter table public.reactions add primary key (summary_id, user_id);

-- 2. Notifications ----------------------------------------------------------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,   -- who is notified
  actor_id uuid not null references public.profiles (id) on delete cascade,  -- who did it
  summary_id uuid not null references public.summaries (id) on delete cascade,
  type text not null default 'comment' check (type in ('comment')),
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_idx
  on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;

-- Members only ever see their own notifications.
drop policy if exists "Members see own notifications" on public.notifications;
create policy "Members see own notifications"
  on public.notifications for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Members mark own notifications read" on public.notifications;
create policy "Members mark own notifications read"
  on public.notifications for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Nobody creates notifications from the website; only the trigger below does.
revoke insert, update, delete on public.notifications from anon, authenticated;
grant update (read_at) on public.notifications to authenticated;

-- Notify the summary's author when someone else comments on it.
create or replace function public.notify_on_comment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  author uuid;
begin
  select user_id into author from public.summaries where id = new.summary_id;

  if author is not null and author <> new.user_id then
    insert into public.notifications (user_id, actor_id, summary_id, type)
    values (author, new.user_id, new.summary_id, 'comment');
  end if;

  return new;
end;
$$;

drop trigger if exists on_comment_created on public.comments;
create trigger on_comment_created
  after insert on public.comments
  for each row execute function public.notify_on_comment();
