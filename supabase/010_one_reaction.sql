-- Run once in the Supabase SQL Editor, AFTER 009_reactions.sql.
-- One reaction per member per summary (tapping another emoji replaces it).

-- One reaction per member per summary -------------------------------------
-- Keep only the newest reaction where a member already picked several.
delete from public.reactions r
using public.reactions newer
where r.summary_id = newer.summary_id
  and r.user_id = newer.user_id
  and (r.created_at, r.ctid) < (newer.created_at, newer.ctid);

alter table public.reactions drop constraint if exists reactions_pkey;
alter table public.reactions add primary key (summary_id, user_id);
