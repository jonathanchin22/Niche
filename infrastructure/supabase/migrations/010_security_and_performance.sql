-- ============================================================
-- NICHE — Security & performance hardening
-- Migration: 010_security_and_performance
-- ============================================================
-- Idempotent. From an audit plus Supabase's security/performance advisors.
--
--   1. profiles.email was readable by anyone holding the public anon key
--      (profiles are world-readable). It duplicated auth.users.email and no
--      app reads it, so stop writing it and drop it.
--   2. Storage: uploads were allowed anywhere in review-images. Limit each
--      user to their own "<app>/<user id>/" folder, and cap size/type.
--   3. Trigger functions were callable through /rest/v1/rpc by anyone.
--      Triggers don't need EXECUTE, so revoke it; pin search_path on the
--      functions that didn't set one.
--   4. RLS policies called auth.uid() once per row; wrap it in a sub-select
--      so Postgres evaluates it once per query.
--   5. Indexes for unindexed foreign keys and the profile/feed queries; drop
--      a duplicate index and a redundant policy.

-- ─── 1. Stop exposing email addresses ────────────────────────────────────────
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  source_app    app_id;
  base_username text;
  final_username text;
  final_display text;
  suffix        int := 0;
begin
  -- Email/password signups send a username; OAuth signups don't, so derive
  -- one from the email and make it satisfy the username check constraints.
  base_username := lower(coalesce(
    nullif(trim(new.raw_user_meta_data->>'username'), ''),
    split_part(coalesce(new.email, ''), '@', 1)
  ));
  base_username := regexp_replace(base_username, '[^a-z0-9_.]', '', 'g');
  if char_length(base_username) < 2 then
    base_username := 'user' || base_username;
  end if;
  base_username := left(base_username, 24);

  final_username := base_username;
  while exists (select 1 from public.profiles where username = final_username) loop
    suffix := suffix + 1;
    final_username := base_username || suffix::text;
  end loop;

  final_display := coalesce(
    nullif(trim(new.raw_user_meta_data->>'display_name'), ''),
    nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
    nullif(trim(new.raw_user_meta_data->>'name'), ''),
    final_username
  );

  -- Email stays in auth.users only; profiles are public.
  insert into public.profiles (id, username, display_name, avatar_url)
  values (
    new.id,
    final_username,
    final_display,
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;

  -- Create initial app membership for the app they signed up through
  begin
    source_app := (new.raw_user_meta_data->>'source_app_id')::app_id;
    if source_app is not null then
      insert into public.app_memberships (user_id, app_id)
      values (new.id, source_app)
      on conflict (user_id, app_id) do nothing;
    end if;
  exception when others then
    -- source_app_id may be missing or invalid — safe to ignore
    null;
  end;

  return new;
end;
$$;

alter table profiles drop column if exists email;

-- ─── 2. Storage: own folder only, images only, 10 MB max ────────────────────
update storage.buckets
set    file_size_limit    = 10 * 1024 * 1024,
       allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
where  id = 'review-images';

drop policy if exists "Users can upload review images" on storage.objects;
create policy "Users can upload review images"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'review-images'
    and (storage.foldername(name))[2] = (select auth.uid())::text
  );

-- ─── 3. Functions: no public RPC access to triggers, fixed search_path ──────
do $$
declare
  fn text;
begin
  foreach fn in array array[
    'award_review_xp()', 'handle_new_user()', 'notify_new_follower()', 'notify_review_comment()',
    'notify_review_like()', 'notify_review_saved()', 'notify_review_upvote()',
    'set_updated_at()', 'update_place_stats()'
  ] loop
    if to_regprocedure('public.' || fn) is not null then
      execute format('revoke execute on function public.%s from public, anon, authenticated', fn);
      execute format('alter function public.%s set search_path = public', fn);
    end if;
  end loop;

  if to_regprocedure('public.get_map_pins(app_id, uuid, double precision, double precision, double precision, double precision)') is not null then
    alter function public.get_map_pins(app_id, uuid, double precision, double precision, double precision, double precision) set search_path = public;
  end if;
  if to_regprocedure('public.deduplicate_places()') is not null then
    alter procedure public.deduplicate_places() set search_path = public;
    revoke execute on procedure public.deduplicate_places() from public, anon, authenticated;
  end if;
end
$$;

-- ─── 4. RLS: evaluate auth.uid() / auth.role() once per query ───────────────
do $$
declare
  pol record;
  new_qual text;
  new_check text;
begin
  for pol in
    select schemaname, tablename, policyname, qual, with_check
    from   pg_policies
    where  schemaname = 'public'
      and  (qual ~ 'auth\.(uid|role)\(\)' or with_check ~ 'auth\.(uid|role)\(\)')
  loop
    -- Already wrapped policies read "( SELECT auth.uid() AS uid)"; leave them.
    new_qual  := case when pol.qual ~* 'select auth\.' then pol.qual
                      else regexp_replace(pol.qual, 'auth\.(uid|role)\(\)', '(select auth.\1())', 'g') end;
    new_check := case when pol.with_check ~* 'select auth\.' then pol.with_check
                      else regexp_replace(pol.with_check, 'auth\.(uid|role)\(\)', '(select auth.\1())', 'g') end;

    if new_qual is distinct from pol.qual then
      execute format('alter policy %I on %I.%I using (%s)', pol.policyname, pol.schemaname, pol.tablename, new_qual);
    end if;
    if new_check is distinct from pol.with_check then
      execute format('alter policy %I on %I.%I with check (%s)', pol.policyname, pol.schemaname, pol.tablename, new_check);
    end if;
  end loop;
end
$$;

-- "Memberships are public" (008) already covers reading your own.
drop policy if exists "Users can view own memberships" on app_memberships;

-- ─── 5. Indexes ──────────────────────────────────────────────────────────────
create index if not exists follows_following_id_idx          on follows(following_id);
create index if not exists notifications_actor_id_idx        on notifications(actor_id);
create index if not exists notifications_comment_id_idx      on notifications(comment_id);
create index if not exists notifications_review_id_idx       on notifications(review_id);
create index if not exists review_comments_review_id_idx     on review_comments(review_id, created_at);
create index if not exists review_comments_user_id_idx       on review_comments(user_id);
-- Profiles and the home feed: a user's cups in one app, newest first.
create index if not exists reviews_user_app_created_idx      on reviews(user_id, app_id, created_at desc);

-- 007 added this alongside the existing places_app_id_google_place_id_key.
drop index if exists places_app_id_google_place_id_idx;

notify pgrst, 'reload schema';
