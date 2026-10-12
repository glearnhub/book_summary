-- Recommended, safe to run any time (the website only ever edits these two columns).
-- Members may edit their own summaries, but only the title and the text, so they
-- cannot change the owner or the original submission date through the API.

revoke update on public.summaries from anon, authenticated;
grant update (book_title, summary) on public.summaries to authenticated;
