-- ============================================================
-- NICHE — A catalog of real places, not just reviewed ones
-- Migration: 012_place_catalog
-- ============================================================
-- Idempotent.
-- Until now a café only existed once someone logged a cup there. This lets the
-- apps seed places from OpenStreetMap by area and classify them:
--   1. places gets source / kind / descriptors / relevant / classification
--      columns. `relevant = false` hides a place (a bakery tagged "cafe")
--      without deleting it.
--   2. seeded_areas records which ~2 km grid cells have been imported per app.
--   3. places_near(): relevant places around a point, nearest first, reviewed
--      or not, excluding the hand-typed places that have no coordinates.
--   4. import_osm_places(): validated bulk upsert for signed-in users. It also
--      "adopts" matching hand-typed places (same name, no coordinates) so old
--      logs gain an address and a map position instead of duplicating.

-- ─── 1. Place metadata ───────────────────────────────────────────────────────
alter table places add column if not exists source text not null default 'user';
alter table places add column if not exists kind text;
alter table places add column if not exists descriptors text[] not null default '{}';
alter table places add column if not exists relevant boolean not null default true;
alter table places add column if not exists classified_by text;
alter table places add column if not exists classified_at timestamptz;
alter table places add column if not exists osm_tags jsonb;

do $$ begin
  alter table places add constraint places_source_check check (source in ('user', 'osm'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table places add constraint places_kind_check check (kind is null or kind in ('specialty', 'chain', 'casual', 'other'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table places add constraint places_classified_by_check check (classified_by is null or classified_by in ('rules', 'model'));
exception when duplicate_object then null; end $$;

-- The classification job looks for OSM places a model hasn't seen yet.
create index if not exists places_unclassified_idx on places(app_id) where source = 'osm' and classified_by is distinct from 'model';

-- ─── 2. Seeded areas ─────────────────────────────────────────────────────────
create table if not exists seeded_areas (
  app_id       app_id not null,
  cell         text not null,
  place_count  int not null default 0,
  seeded_at    timestamptz not null default now(),
  primary key (app_id, cell)
);

alter table seeded_areas enable row level security;

drop policy if exists "Seeded areas are readable" on seeded_areas;
create policy "Seeded areas are readable" on seeded_areas for select using (true);

-- ─── 3. Places near a point ──────────────────────────────────────────────────
create or replace function places_near(
  p_app_id    app_id,
  p_lat       double precision,
  p_lng       double precision,
  p_radius_m  int default 2000,
  p_limit     int default 40
)
returns table (
  id uuid, name text, address text, city text, state text, lat double precision, lng double precision,
  google_place_id text, cover_image_url text, avg_score numeric, review_count int,
  kind text, descriptors text[], distance_m double precision
)
language sql
stable
set search_path = public
as $$
  select p.id, p.name, p.address, p.city, p.state, p.lat, p.lng,
         p.google_place_id, p.cover_image_url, p.avg_score, p.review_count,
         p.kind, p.descriptors,
         st_distance(p.location, st_point(p_lng, p_lat)::geography) as distance_m
  from   places p
  where  p.app_id = p_app_id
    and  p.relevant
    and  not (p.lat = 0 and p.lng = 0)
    and  st_dwithin(p.location, st_point(p_lng, p_lat)::geography, least(greatest(p_radius_m, 100), 20000))
  order  by distance_m
  limit  least(greatest(p_limit, 1), 100)
$$;

grant execute on function places_near(app_id, double precision, double precision, int, int) to anon, authenticated;

-- ─── 4. Import from OpenStreetMap ────────────────────────────────────────────
-- p_places: [{ osm_id, name, address, city, state, lat, lng, kind, relevant, descriptors, tags }]
-- Callable by any signed-in user (places are already user-creatable); every
-- field is validated and a call is capped at 150 places.
create or replace function import_osm_places(p_app_id app_id, p_cell text, p_places jsonb)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  item      jsonb;
  osm_id    text;
  pname     text;
  plat      double precision;
  plng      double precision;
  pkind     text;
  existing  uuid;
  typed     uuid;
  imported  int := 0;
begin
  if auth.uid() is null then
    raise exception 'must be signed in' using errcode = '42501';
  end if;
  if jsonb_typeof(p_places) <> 'array' or jsonb_array_length(p_places) > 150 then
    raise exception 'expected an array of at most 150 places' using errcode = '22023';
  end if;
  -- p_cell is null for a one-off import (a search result), which mustn't mark
  -- the whole area as seeded.
  if p_cell is not null and p_cell !~ '^-?[0-9]+:-?[0-9]+$' then
    raise exception 'bad cell' using errcode = '22023';
  end if;

  for item in select * from jsonb_array_elements(p_places) loop
    typed := null;
    osm_id := item->>'osm_id';
    pname  := left(trim(item->>'name'), 120);
    plat   := (item->>'lat')::double precision;
    plng   := (item->>'lng')::double precision;
    pkind  := item->>'kind';

    if osm_id !~ '^osm_(node|way|relation)_[0-9]+$' or pname is null or pname = ''
       or plat not between -90 and 90 or plng not between -180 and 180
       or (plat = 0 and plng = 0)
       or (pkind is not null and pkind not in ('specialty', 'chain', 'casual', 'other')) then
      continue;
    end if;

    select id into existing from places where app_id = p_app_id and google_place_id = osm_id;

    if existing is null and coalesce(pkind, '') <> 'chain' then
      -- A hand-typed place with this exact name and no coordinates: adopt it,
      -- so its cups gain a real address rather than splitting into two places.
      -- Only when the name is unambiguous in this import, and the person whose
      -- area is being seeded has logged there (so it's very likely the same
      -- café, not a namesake in another city).
      if (select count(*) from jsonb_array_elements(p_places) e where lower(trim(e->>'name')) = lower(pname)) = 1 then
        select p.id into typed from places p
        where p.app_id = p_app_id and p.google_place_id is null and p.lat = 0 and p.lng = 0
          and lower(p.name) = lower(pname)
          and exists (select 1 from reviews r where r.place_id = p.id and r.user_id = auth.uid())
        order by p.created_at limit 1;
        if typed is not null then
          update places set google_place_id = osm_id, lat = plat, lng = plng,
                 address = coalesce(nullif(item->>'address', ''), address),
                 city = coalesce(nullif(item->>'city', ''), city),
                 state = coalesce(nullif(item->>'state', ''), state),
                 updated_at = now()
          where id = typed;
          existing := typed;
        end if;
      end if;
    end if;

    if existing is null then
      insert into places (app_id, name, address, city, state, country, lat, lng, google_place_id, source)
      values (p_app_id, pname, coalesce(item->>'address', ''), coalesce(item->>'city', ''), coalesce(item->>'state', ''), 'US', plat, plng, osm_id, 'osm')
      returning id into existing;
    end if;

    -- Map facts and rule-based classification; never overwrite a model's.
    update places set
      osm_tags     = case when jsonb_typeof(item->'tags') = 'object' then item->'tags' else osm_tags end,
      address      = case when coalesce(address, '') = '' then coalesce(item->>'address', '') else address end,
      city         = case when coalesce(city, '') = '' then coalesce(item->>'city', '') else city end,
      kind         = case when classified_by = 'model' then kind else pkind end,
      relevant     = case when classified_by = 'model' then relevant else coalesce((item->>'relevant')::boolean, true) end,
      descriptors  = case when classified_by = 'model' then descriptors
                          else coalesce(array(select left(d, 32) from jsonb_array_elements_text(coalesce(item->'descriptors', '[]')) d limit 8), '{}') end,
      classified_by = case when classified_by = 'model' then classified_by else 'rules' end,
      classified_at = case when classified_by = 'model' then classified_at else now() end
    where id = existing;

    imported := imported + 1;
  end loop;

  if p_cell is not null then
    insert into seeded_areas (app_id, cell, place_count, seeded_at)
    values (p_app_id, p_cell, imported, now())
    on conflict (app_id, cell) do update set place_count = excluded.place_count, seeded_at = excluded.seeded_at;
  end if;

  return imported;
end;
$$;

revoke all on function import_osm_places(app_id, text, jsonb) from public, anon;
grant execute on function import_osm_places(app_id, text, jsonb) to authenticated;

notify pgrst, 'reload schema';
