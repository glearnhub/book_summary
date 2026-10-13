-- Run once in the Supabase SQL Editor.
-- Removes everything the notification experiments added: the in-app
-- notifications table and trigger, and the email trigger and its private
-- settings. Safe to run even if some of these were never created.
-- Comments and reactions are not touched.

drop trigger if exists on_comment_created on public.comments;  -- in-app notifications
drop trigger if exists on_comment_email on public.comments;    -- email notifications

drop function if exists public.notify_on_comment();
drop function if exists private.email_on_comment();

drop table if exists public.notifications cascade;
drop table if exists private.app_secrets cascade;
