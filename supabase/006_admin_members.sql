-- Run once in the Supabase SQL Editor, AFTER 002_admin_books.sql.
-- Lets the superadmin see every account: name, email, join date, last sign-in,
-- role and number of summaries. Emails live in Supabase's private auth table,
-- so they are only exposed through this function, which refuses anyone who is
-- not the superadmin.

create or replace function public.admin_list_members()
returns table (
  member_id uuid,
  display_name text,
  email text,
  role text,
  joined_at timestamptz,
  last_sign_in_at timestamptz,
  email_confirmed boolean,
  summaries bigint
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_superadmin() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  return query
  select
    p.id,
    p.display_name,
    u.email::text,
    p.role,
    u.created_at,
    u.last_sign_in_at,
    (u.email_confirmed_at is not null),
    (select count(*) from public.summaries s where s.user_id = p.id)
  from public.profiles p
  join auth.users u on u.id = p.id
  order by u.created_at desc;
end;
$$;

revoke all on function public.admin_list_members() from public, anon;
grant execute on function public.admin_list_members() to authenticated;
