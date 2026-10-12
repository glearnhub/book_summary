-- Run this once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.

-- 1. Profiles: one row per user, holds the public display name
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 50),
  created_at timestamptz not null default now()
);

-- 2. Summaries: one row per submitted book summary
create table if not exists public.summaries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  book_title text not null check (char_length(book_title) between 1 and 200),
  summary text not null check (char_length(summary) between 1 and 10000),
  created_at timestamptz not null default now()
);

create index if not exists summaries_created_at_idx on public.summaries (created_at desc);
create index if not exists summaries_user_id_idx on public.summaries (user_id);

-- 3. Create a profile automatically when someone signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    left(
      coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), split_part(new.email, '@', 1)),
      50
    )
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 4. Row Level Security: everyone can read, only the owner can write
alter table public.profiles enable row level security;
alter table public.summaries enable row level security;

drop policy if exists "Profiles are public" on public.profiles;
create policy "Profiles are public"
  on public.profiles for select
  using (true);

drop policy if exists "Users update own profile" on public.profiles;
create policy "Users update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "Summaries are public" on public.summaries;
create policy "Summaries are public"
  on public.summaries for select
  using (true);

drop policy if exists "Members insert own summaries" on public.summaries;
create policy "Members insert own summaries"
  on public.summaries for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Members update own summaries" on public.summaries;
create policy "Members update own summaries"
  on public.summaries for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Members delete own summaries" on public.summaries;
create policy "Members delete own summaries"
  on public.summaries for delete
  to authenticated
  using (auth.uid() = user_id);
