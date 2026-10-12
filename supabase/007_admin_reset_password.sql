-- Run once in the Supabase SQL Editor, AFTER 002_admin_books.sql.
-- Lets the superadmin set a new password for any member (for example when
-- someone forgets theirs). The function refuses anyone who is not the superadmin,
-- requires a password of at least 8 characters, and signs the member out of
-- their existing sessions.

create extension if not exists pgcrypto with schema extensions;

create or replace function public.admin_reset_password(target_user uuid, new_password text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_superadmin() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  if new_password is null or char_length(new_password) < 8 then
    raise exception 'Password must be at least 8 characters' using errcode = '22023';
  end if;

  if not exists (select 1 from public.profiles where id = target_user) then
    raise exception 'Member not found' using errcode = 'P0002';
  end if;

  update auth.users
  set encrypted_password = extensions.crypt(new_password, extensions.gen_salt('bf')),
      updated_at = now()
  where id = target_user;

  -- Sign the member out everywhere so the old password stops working at once.
  begin
    delete from auth.sessions where user_id = target_user;
  exception when others then
    null;
  end;
end;
$$;

revoke all on function public.admin_reset_password(uuid, text) from public, anon;
grant execute on function public.admin_reset_password(uuid, text) to authenticated;
