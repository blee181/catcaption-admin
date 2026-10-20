# CATCAPTION Admin — Week 6

Protected admin panel for the CATCAPTION rating app.

## Rubric coverage

- Google login wall for every admin route
- Database-backed superadmin gate using `profiles.is_superadmin`
- READ users/profiles
- CREATE / READ / UPDATE / DELETE AI-generated captions
- READ upvotes/downvotes/ratings
- Dashboard statistics for profiles, captions, ratings, vote share, and top caption
- Uses the existing CATCAPTION Supabase database

## Required setup

1. Run `week6_admin.sql` once in the existing CATCAPTION Supabase SQL Editor.
2. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in Vercel.
3. Add the admin deployment URL plus `/auth/callback` to Supabase Auth redirect URLs.
4. Turn off Vercel Deployment Protection.
