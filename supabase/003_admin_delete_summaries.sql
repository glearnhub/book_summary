-- Run once in the Supabase SQL Editor, AFTER 002_admin_books.sql.
-- Lets the superadmin delete any member's summary. Members can still only
-- delete their own (that policy is unchanged; policies are combined with OR).

drop policy if exists "Superadmin deletes any summary" on public.summaries;
create policy "Superadmin deletes any summary"
  on public.summaries for delete
  to authenticated
  using (public.is_superadmin());
