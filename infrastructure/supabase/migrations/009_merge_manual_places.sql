-- ============================================================
-- NICHE — Merge duplicate hand-typed places
-- Migration: 009_merge_manual_places
-- ============================================================
-- Idempotent.
-- The first boba app gave every typed-in shop a unique fake google_place_id
-- ("manual_<timestamp>"), so logging "7leaves" twice made two places and
-- neither 006's name-based dedupe nor its unique index could see them.
-- The apps now save typed names with google_place_id NULL (matched by name),
-- so these ids are treated the same way:
--   1. Merge every (app_id, lower(name)) group of NULL/manual rows into its
--      oldest row, moving reviews across first (deleting a place cascades
--      to its reviews).
--   2. Clear the fake ids, so 006's unique index keeps them merged.
--   3. Recompute review_count / avg_score for the places that changed.

do $$
declare
  dup record;
  canonical_id uuid;
begin
  for dup in
    select app_id, lower(name) as norm_name
    from   places
    where  google_place_id is null or google_place_id like 'manual\_%'
    group  by app_id, lower(name)
    having count(*) > 1
  loop
    select id into canonical_id
    from   places
    where  app_id = dup.app_id
      and  lower(name) = dup.norm_name
      and  (google_place_id is null or google_place_id like 'manual\_%')
    order  by created_at asc
    limit  1;

    update reviews
    set    place_id = canonical_id
    where  place_id in (
      select id from places
      where  app_id = dup.app_id
        and  lower(name) = dup.norm_name
        and  (google_place_id is null or google_place_id like 'manual\_%')
        and  id <> canonical_id
    );

    delete from places
    where  app_id = dup.app_id
      and  lower(name) = dup.norm_name
      and  (google_place_id is null or google_place_id like 'manual\_%')
      and  id <> canonical_id;
  end loop;
end
$$;

update places set google_place_id = null where google_place_id like 'manual\_%';

update places p
set    avg_score    = s.avg_score,
       review_count = s.review_count
from (
  select pl.id,
         round(avg(r.score)::numeric, 2) as avg_score,
         count(r.id)::int               as review_count
  from   places pl
  left   join reviews r on r.place_id = pl.id
  group  by pl.id
) s
where  s.id = p.id
  and (p.review_count is distinct from s.review_count
       or p.avg_score is distinct from s.avg_score);
