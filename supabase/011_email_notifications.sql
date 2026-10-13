-- Run once in the Supabase SQL Editor.
--
-- Sends an email to the author when someone comments on their book summary.
-- Reactions never send anything. The in-app notifications from the earlier
-- version are removed.
--
-- How it works: when a comment is inserted, a trigger asks the website's
-- /api/notify function (on Vercel) to send the email. The function URL and a
-- shared secret are kept in a private table that the website cannot read.
--
-- AFTER running this file, run the two INSERT statements at the bottom
-- (with your own values) so the trigger knows where to send the request.

-- 0. Remove the old in-app notifications -----------------------------------
drop trigger if exists on_comment_created on public.comments;
drop function if exists public.notify_on_comment();
drop table if exists public.notifications cascade;

-- 1. Allow the database to make HTTP requests ------------------------------
create extension if not exists pg_net;

-- 2. Private settings (not exposed through the website's API) ---------------
create schema if not exists private;
revoke all on schema private from anon, authenticated;

create table if not exists private.app_secrets (
  name text primary key,
  value text not null
);

revoke all on private.app_secrets from anon, authenticated;

-- 3. Trigger: email the summary's author when someone else comments --------
create or replace function private.email_on_comment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  author_id uuid;
  book text;
  recipient text;
  actor text;
  endpoint text;
  secret text;
begin
  select user_id, book_title into author_id, book
  from public.summaries where id = new.summary_id;

  -- Nothing to do when you comment on your own summary.
  if author_id is null or author_id = new.user_id then
    return new;
  end if;

  -- Sending the email must never stop the comment from being saved.
  begin
    select email into recipient from auth.users where id = author_id;
    select display_name into actor from public.profiles where id = new.user_id;
    select value into endpoint from private.app_secrets where name = 'notify_url';
    select value into secret from private.app_secrets where name = 'notify_secret';

    if recipient is not null and endpoint is not null and secret is not null then
      perform net.http_post(
        url := endpoint,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-notify-secret', secret
        ),
        body := jsonb_build_object(
          'to', recipient,
          'actor', coalesce(actor, 'A member'),
          'book_title', book,
          'comment', left(new.body, 500)
        )
      );
    end if;
  exception when others then
    null;
  end;

  return new;
end;
$$;

revoke all on function private.email_on_comment() from public, anon, authenticated;

drop trigger if exists on_comment_email on public.comments;
create trigger on_comment_email
  after insert on public.comments
  for each row execute function private.email_on_comment();

-- 4. Tell the trigger where to send requests ---------------------------------
-- Run these two statements yourself with your own values. Use a long random
-- string for the secret and put the SAME value in Vercel as NOTIFY_SECRET.
-- (Do not commit real values to git.)
--
--   insert into private.app_secrets (name, value) values
--     ('notify_url',    'https://YOUR-SITE.vercel.app/api/notify'),
--     ('notify_secret', 'PASTE-A-LONG-RANDOM-STRING')
--   on conflict (name) do update set value = excluded.value;
