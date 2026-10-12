-- Run this once in the Supabase SQL Editor, AFTER schema.sql.
-- Adds a superadmin role, a books catalog, and book assignments.

-- 1. Roles ---------------------------------------------------------------
alter table public.profiles
  add column if not exists role text not null default 'member'
  check (role in ('member', 'superadmin'));

-- Members may only change their own display name. Without this, the existing
-- "update own profile" policy would let anyone promote themselves to superadmin.
revoke update on public.profiles from anon, authenticated;
grant update (display_name) on public.profiles to authenticated;

create or replace function public.is_superadmin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'superadmin'
  );
$$;

revoke all on function public.is_superadmin() from public;
grant execute on function public.is_superadmin() to authenticated;

-- 2. Books catalog ---------------------------------------------------------
create table if not exists public.books (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 200),
  author text check (author is null or char_length(author) <= 100),
  created_at timestamptz not null default now()
);

alter table public.books enable row level security;

drop policy if exists "Books are public" on public.books;
create policy "Books are public"
  on public.books for select
  using (true);

drop policy if exists "Superadmin adds books" on public.books;
create policy "Superadmin adds books"
  on public.books for insert
  to authenticated
  with check (public.is_superadmin());

drop policy if exists "Superadmin edits books" on public.books;
create policy "Superadmin edits books"
  on public.books for update
  to authenticated
  using (public.is_superadmin())
  with check (public.is_superadmin());

drop policy if exists "Superadmin deletes books" on public.books;
create policy "Superadmin deletes books"
  on public.books for delete
  to authenticated
  using (public.is_superadmin());

-- 3. Assignments: which member should read which book ----------------------
create table if not exists public.assignments (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  assigned_by uuid references auth.users (id) on delete set null default auth.uid(),
  due_date date,
  created_at timestamptz not null default now(),
  unique (book_id, user_id)
);

create index if not exists assignments_user_id_idx on public.assignments (user_id);

alter table public.assignments enable row level security;

drop policy if exists "Members see own assignments" on public.assignments;
create policy "Members see own assignments"
  on public.assignments for select
  to authenticated
  using (auth.uid() = user_id or public.is_superadmin());

drop policy if exists "Superadmin creates assignments" on public.assignments;
create policy "Superadmin creates assignments"
  on public.assignments for insert
  to authenticated
  with check (public.is_superadmin());

drop policy if exists "Superadmin edits assignments" on public.assignments;
create policy "Superadmin edits assignments"
  on public.assignments for update
  to authenticated
  using (public.is_superadmin())
  with check (public.is_superadmin());

drop policy if exists "Superadmin deletes assignments" on public.assignments;
create policy "Superadmin deletes assignments"
  on public.assignments for delete
  to authenticated
  using (public.is_superadmin());

-- 4. Make ONE person the superadmin ------------------------------------------
-- They must have created an account first. Replace the email with the one they
-- signed up with, then run just this statement:
--
--   update public.profiles
--   set role = 'superadmin'
--   where id = (select id from auth.users where email = 'REPLACE-WITH-THEIR-EMAIL');
