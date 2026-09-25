-- ============================================================
-- NICHE — Safety, account deletion & personal rankings
-- Migration: 011_safety_accounts_and_ranking
-- ============================================================
-- Idempotent.
--   1. blocks: hide someone's cups, comments and profile from you (and
--      stop them following you). App stores require block + report for
--      user-generated content.
--   2. reports: flag a cup, comment or person for review. Write-only for
--      users; read in the Supabase dashboard.
--   3. delete_my_account(): in-app account deletion (required by the App
--      Store and Play Store). Deleting the auth user cascades to every table.
--      Photos are removed by the app through the Storage API first, so
--      users get a delete policy on their own folder.
--   4. reviews.personal_rank: each person's own ordering of their cups,
--      built from "which was better?" comparisons. Higher = better. Existing
--      cups start at their score.

-- ─── 1. Blocks ───────────────────────────────────────────────────────────────
create table if not exists blocks (
  blocker_id  uuid not null references profiles(id) on delete cascade,
  blocked_id  uuid not null references profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

alter table blocks enable row level security;

drop policy if exists "Users see their own blocks" on blocks;
create policy "Users see their own blocks"
  on blocks for select using ((select auth.uid()) = blocker_id);

drop policy if exists "Users can block" on blocks;
create policy "Users can block"
  on blocks for insert with check ((select auth.uid()) = blocker_id);

drop policy if exists "Users can unblock" on blocks;
create policy "Users can unblock"
  on blocks for delete using ((select auth.uid()) = blocker_id);

create index if not exists blocks_blocked_id_idx on blocks(blocked_id);

-- Blocking also removes the follow in both directions.
create or replace function unfollow_on_block()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  delete from follows
  where (follower_id = new.blocker_id and following_id = new.blocked_id)
     or (follower_id = new.blocked_id and following_id = new.blocker_id);
  return null;
end;
$$;

drop trigger if exists on_block_unfollow on blocks;
create trigger on_block_unfollow
  after insert on blocks
  for each row execute procedure unfollow_on_block();

revoke execute on function unfollow_on_block() from public, anon, authenticated;

-- Blocks work both ways and are enforced in RLS, so every query in every
-- app hides them without extra code. Blocks are private (you only see your
-- own rows), hence a security-definer helper to check either direction. It
-- lives in a schema the API doesn't expose, so it can't be called over
-- /rest/v1/rpc to probe who blocked whom.
create schema if not exists private;
grant usage on schema private to anon, authenticated;

create or replace function private.is_blocked_between(a uuid, b uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select a is not null and b is not null and exists (
    select 1 from public.blocks
    where (blocker_id = a and blocked_id = b)
       or (blocker_id = b and blocked_id = a)
  );
$$;

revoke all on function private.is_blocked_between(uuid, uuid) from public;
grant execute on function private.is_blocked_between(uuid, uuid) to anon, authenticated;

drop policy if exists "Reviews are public" on reviews;
create policy "Reviews are public"
  on reviews for select using (not private.is_blocked_between((select auth.uid()), user_id));

drop policy if exists "Comments are public" on review_comments;
create policy "Comments are public"
  on review_comments for select using (not private.is_blocked_between((select auth.uid()), user_id));

-- A blocked person can't follow you back.
drop policy if exists "Users can follow others" on follows;
create policy "Users can follow others"
  on follows for insert with check (
    (select auth.uid()) = follower_id
    and not private.is_blocked_between(follower_id, following_id)
  );

-- ─── 2. Reports ──────────────────────────────────────────────────────────────
create table if not exists reports (
  id                uuid primary key default gen_random_uuid(),
  reporter_id       uuid not null references profiles(id) on delete cascade,
  review_id         uuid references reviews(id) on delete set null,
  comment_id        uuid references review_comments(id) on delete set null,
  reported_user_id  uuid references profiles(id) on delete set null,
  reason            text not null check (reason in ('spam', 'harassment', 'inappropriate', 'fake', 'other')),
  details           text check (char_length(details) <= 1000),
  status            text not null default 'open' check (status in ('open', 'reviewed', 'actioned', 'dismissed')),
  created_at        timestamptz not null default now(),
  check (review_id is not null or comment_id is not null or reported_user_id is not null)
);

alter table reports enable row level security;

drop policy if exists "Users can report" on reports;
create policy "Users can report"
  on reports for insert with check ((select auth.uid()) = reporter_id);

create index if not exists reports_status_created_idx on reports(status, created_at desc);
create index if not exists reports_reporter_id_idx on reports(reporter_id);
create index if not exists reports_review_id_idx on reports(review_id);
create index if not exists reports_comment_id_idx on reports(comment_id);
create index if not exists reports_reported_user_id_idx on reports(reported_user_id);

-- ─── 3. Account deletion ─────────────────────────────────────────────────────
create or replace function delete_my_account()
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'must be signed in' using errcode = '42501';
  end if;
  -- profiles, reviews, comments, votes, saves, follows, memberships,
  -- notifications and blocks all cascade from auth.users.
  delete from auth.users where id = me;
end;
$$;

revoke all on function delete_my_account() from public, anon;
grant execute on function delete_my_account() to authenticated;

drop policy if exists "Users can delete their own review images" on storage.objects;
create policy "Users can delete their own review images"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'review-images'
    and (storage.foldername(name))[2] = (select auth.uid())::text
  );

-- ─── 4. Personal rankings ────────────────────────────────────────────────────
alter table reviews add column if not exists personal_rank double precision;
update reviews set personal_rank = score where personal_rank is null;

create index if not exists reviews_user_app_rank_idx on reviews(user_id, app_id, personal_rank desc);

notify pgrst, 'reload schema';
