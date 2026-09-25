-- ============================================================
-- NICHE — First reviews ("be the first") and their badges
-- Migration: 013_first_reviews
-- ============================================================
-- Idempotent.
-- A "first" is a place where your review is the earliest one in that app.
-- Home brews ("brew_home", "boba_home") don't count. Badge tiers live in the
-- apps (packages/database/src/firsts.ts); the database only counts.
--
-- security definer so the count is the same for everyone who looks (review
-- visibility can differ per viewer once blocks apply); it returns only a number.

-- The earliest review at a place, straight from the index.
create index if not exists reviews_place_created_idx on reviews(place_id, created_at, id);

create or replace function first_review_count(p_user_id uuid, p_app_id app_id)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int
  from (
    select distinct r.place_id
    from reviews r
    where r.user_id = p_user_id and r.app_id = p_app_id
  ) mine
  join places p on p.id = mine.place_id
  where coalesce(p.google_place_id, '') not like '%\_home'
    and (
      select f.user_id from reviews f
      where f.place_id = mine.place_id and f.app_id = p_app_id
      order by f.created_at, f.id
      limit 1
    ) = p_user_id
$$;

revoke all on function first_review_count(uuid, app_id) from public;
grant execute on function first_review_count(uuid, app_id) to authenticated;
