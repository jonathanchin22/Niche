-- ============================================================
-- NICHE — "Want to try" saves + social reads for the brew redesign
-- Migration: 008_want_to_try_and_social
-- ============================================================
-- Idempotent.
--   1. review_saves: a user saves someone's cup to their "want to try" list.
--      The saver and the review's author can see the row (the author gets
--      "priya saved your cortado" in their activity).
--   2. A 'review_saved' notification for the review's author.
--   3. app_memberships becomes readable by everyone, so the friends screen can
--      suggest people who are already on another niche app ("already on boba").
--      Memberships only hold app ids, join dates, XP and badges.
--
-- "Cheers" reuse review_votes with vote = 1; the brew app no longer creates
-- downvotes and ignores existing ones, so no vote data changes here.

-- ─── 1. review_saves ─────────────────────────────────────────────────────────
create table if not exists review_saves (
  user_id     uuid not null references profiles(id) on delete cascade,
  review_id   uuid not null references reviews(id) on delete cascade,
  created_at  timestamptz not null default now(),

  primary key (user_id, review_id)
);

alter table review_saves enable row level security;

drop policy if exists "Savers and authors can see saves" on review_saves;
create policy "Savers and authors can see saves"
  on review_saves for select using (
    auth.uid() = user_id
    or auth.uid() = (select r.user_id from reviews r where r.id = review_id)
  );

drop policy if exists "Users can save" on review_saves;
create policy "Users can save"
  on review_saves for insert with check (auth.uid() = user_id);

drop policy if exists "Users can unsave" on review_saves;
create policy "Users can unsave"
  on review_saves for delete using (auth.uid() = user_id);

create index if not exists review_saves_review_id_idx on review_saves(review_id);
create index if not exists review_saves_user_created_idx on review_saves(user_id, created_at desc);

-- ─── 2. Notify the author when their cup is saved ────────────────────────────
alter type notification_type add value if not exists 'review_saved';

create or replace function notify_review_saved()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  review_author uuid;
begin
  select user_id into review_author from reviews where id = new.review_id;

  if review_author is null or review_author = new.user_id then
    return null;
  end if;

  insert into notifications (user_id, type, actor_id, review_id)
  values (review_author, 'review_saved', new.user_id, new.review_id);

  return null;
end;
$$;

drop trigger if exists on_review_saved on review_saves;
create trigger on_review_saved
  after insert on review_saves
  for each row execute procedure notify_review_saved();

-- ─── 3. Public app memberships ───────────────────────────────────────────────
drop policy if exists "Memberships are public" on app_memberships;
create policy "Memberships are public"
  on app_memberships for select using (true);

notify pgrst, 'reload schema';
