# Book Circle

A small website where friends sign up, submit a weekly book summary, and browse
or search everyone's summaries. Plain HTML, CSS, JavaScript and Bootstrap, with
Supabase as the backend (accounts + database). No build step.

## 1. Create the Supabase project

1. Create a free project at https://supabase.com.
2. Open **SQL Editor -> New query**, paste the contents of `supabase/schema.sql`, and run it.
3. Open **Project Settings -> API** and copy the **Project URL** and the **anon public** key.
4. Paste both into `js/config.js`.

The anon key is meant to be public. Row Level Security (set up by the SQL file)
means everyone can read summaries, but only a signed-in member can add one, and
only the author can edit or delete their own.

### Admin, books and assignments

After `schema.sql`, also run `supabase/002_admin_books.sql`. It adds a
superadmin role, a catalog of available books, and per-member book assignments.

To make someone the superadmin, they must first sign up on the site. Then run
this in the SQL Editor with the email they signed up with:

    update public.profiles
    set role = 'superadmin'
    where id = (select id from auth.users where email = 'THEIR-EMAIL');

The superadmin sees an **Admin** link in the navigation, where they can add
books and assign them to members. Members see their assigned books on the
**Submit a summary** page. The role cannot be changed from the website.

## 2. Email confirmation (optional)

By default Supabase emails a confirmation link on sign-up. For a small group of
friends you can turn this off under **Authentication -> Providers -> Email ->
Confirm email**, so people can sign in immediately.

## 3. Run locally

Any static server works, for example:

    php -S localhost:8014

then open http://localhost:8014.

## 4. Deploy to Vercel

1. Push this folder to a GitHub repository.
2. In Vercel choose **Add New -> Project**, import the repo, set **Framework
   Preset** to **Other**, leave build settings empty, and deploy.
3. In Supabase go to **Authentication -> URL Configuration** and set **Site URL**
   to your Vercel URL (needed for email confirmation links).
