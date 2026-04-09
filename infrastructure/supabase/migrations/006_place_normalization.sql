-- ============================================================
-- NICHE — Place Normalization & Deduplication
-- Migration: 006_place_normalization
-- ============================================================
-- Goals:
--   1. Prevent future duplicate places when google_place_id is NULL
--      by adding a partial unique index on (app_id, lower(name)).
--   2. Provide a deduplicate_places() procedure that consolidates
--      existing duplicate rows and re-points reviews to the canonical
--      place entry (earliest created_at wins).
--   3. Provide a find_or_create_place() function used by the API
--      layer to atomically look up or insert a place record.

-- ─── 1. Partial unique index to prevent future name-based duplicates ──────────
-- Only enforced when google_place_id IS NULL (manual / home-brew entries).
-- Entries that came from a real geocoding source keep the google_place_id
-- uniqueness path.

create unique index if not exists places_app_id_name_no_gid_idx
  on places (app_id, lower(name))
  where google_place_id is null;

-- ─── 2. Deduplication procedure ───────────────────────────────────────────────
-- Idempotent: safe to re-run.  For each (app_id, lower(name)) group that has
-- more than one row with google_place_id IS NULL, we:
--   a) Pick the oldest row as the canonical place.
--   b) Re-point all reviews that reference a duplicate place to the canonical one.
--   c) Delete the now-orphaned duplicate place rows.

create or replace procedure deduplicate_places()
language plpgsql
as $$
declare
  dup record;
  canonical_id uuid;
begin
  -- Find every (app_id, lower(name)) group that has >1 null-gid row
  for dup in
    select app_id, lower(name) as norm_name
    from   places
    where  google_place_id is null
    group  by app_id, lower(name)
    having count(*) > 1
  loop
    -- The canonical place = the one inserted first
    select id into canonical_id
    from   places
    where  app_id = dup.app_id
      and  lower(name) = dup.norm_name
      and  google_place_id is null
    order  by created_at asc
    limit  1;

    -- Re-point reviews from duplicate place rows to the canonical one
    update reviews
    set    place_id  = canonical_id,
           updated_at = now()
    where  place_id in (
      select id
      from   places
      where  app_id = dup.app_id
        and  lower(name) = dup.norm_name
        and  google_place_id is null
        and  id <> canonical_id
    );

    -- Delete duplicate (now orphaned) place rows
    delete from places
    where  app_id = dup.app_id
      and  lower(name) = dup.norm_name
      and  google_place_id is null
      and  id <> canonical_id;

  end loop;
end;
$$;

-- ─── 3. find_or_create_place() ────────────────────────────────────────────────
-- Atomic helper called by the API layer.
--
-- Matching priority:
--   1. Exact google_place_id match   (when p_google_place_id IS NOT NULL)
--   2. Case-insensitive name match   (when google_place_id IS NULL)
--
-- Returns the place id of the matched or newly-inserted row.

create or replace function find_or_create_place(
  p_app_id          app_id,         -- app_id is a custom ENUM type (see migration 001)
  p_name            text,
  p_address         text,
  p_city            text,
  p_state           text,
  p_country         text,
  p_lat             double precision,
  p_lng             double precision,
  p_google_place_id text    default null,
  p_foursquare_id   text    default null,
  p_cover_image_url text    default null
)
returns uuid
language plpgsql
as $$
declare
  v_id uuid;
begin
  -- ── Path 1: google_place_id provided ──────────────────────────────────────
  if p_google_place_id is not null then
    -- Try to find an existing row
    select id into v_id
    from   places
    where  app_id          = p_app_id
      and  google_place_id = p_google_place_id
    limit  1;

    if v_id is not null then
      -- Update mutable fields and return
      update places
      set    name              = p_name,
             address           = p_address,
             city              = p_city,
             state             = p_state,
             country           = p_country,
             lat               = p_lat,
             lng               = p_lng,
             foursquare_id     = coalesce(p_foursquare_id, foursquare_id),
             cover_image_url   = coalesce(p_cover_image_url, cover_image_url),
             updated_at        = now()
      where  id = v_id;
      return v_id;
    end if;

    -- No match — insert and return
    insert into places
      (app_id, name, address, city, state, country, lat, lng,
       google_place_id, foursquare_id, cover_image_url)
    values
      (p_app_id, p_name, p_address, p_city, p_state, p_country, p_lat, p_lng,
       p_google_place_id, p_foursquare_id, p_cover_image_url)
    returning id into v_id;

    return v_id;
  end if;

  -- ── Path 2: no google_place_id — match by (app_id, lower(name)) ───────────
  select id into v_id
  from   places
  where  app_id          = p_app_id
    and  lower(name)     = lower(p_name)
    and  google_place_id is null
  limit  1;

  if v_id is not null then
    -- Update address/geo if the caller supplied real values
    update places
    set    address     = case when p_address <> '' then p_address else address end,
           city        = case when p_city    <> '' then p_city    else city    end,
           state       = case when p_state   <> '' then p_state   else state   end,
           lat         = case when p_lat     <> 0  then p_lat     else lat     end,
           lng         = case when p_lng     <> 0  then p_lng     else lng     end,
           updated_at  = now()
    where  id = v_id;
    return v_id;
  end if;

  -- No match — insert; partial unique index prevents races
  -- The conflict target (app_id, lower(name)) WHERE google_place_id IS NULL
  -- references the places_app_id_name_no_gid_idx partial unique index by
  -- inference, which is the correct PostgreSQL syntax for partial indexes.
  insert into places
    (app_id, name, address, city, state, country, lat, lng,
     google_place_id, foursquare_id, cover_image_url)
  values
    (p_app_id, p_name, p_address, p_city, p_state, p_country, p_lat, p_lng,
     null, p_foursquare_id, p_cover_image_url)
  on conflict (app_id, lower(name))
    where google_place_id is null
  do update set
    address    = case when excluded.address <> '' then excluded.address else places.address end,
    city       = case when excluded.city    <> '' then excluded.city    else places.city    end,
    state      = case when excluded.state   <> '' then excluded.state   else places.state   end,
    lat        = case when excluded.lat     <> 0  then excluded.lat     else places.lat     end,
    lng        = case when excluded.lng     <> 0  then excluded.lng     else places.lng     end,
    updated_at = now()
  returning id into v_id;

  return v_id;
end;
$$;

-- ─── 4. Run deduplication on existing data ────────────────────────────────────
call deduplicate_places();
