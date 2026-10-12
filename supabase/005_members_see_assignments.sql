-- Run once in the Supabase SQL Editor, AFTER 002_admin_books.sql.
-- Lets signed-in members see which books are assigned to whom, so the Books
-- page can show assigned vs unassigned books. Only the superadmin can still
-- create, change or remove assignments.

drop policy if exists "Members see own assignments" on public.assignments;
drop policy if exists "Members see all assignments" on public.assignments;

create policy "Members see all assignments"
  on public.assignments for select
  to authenticated
  using (true);
