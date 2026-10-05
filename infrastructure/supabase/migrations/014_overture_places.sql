-- ============================================================
-- NICHE — Places imported from Overture Maps
-- Migration: 014_overture_places
-- ============================================================
-- Idempotent.
-- OpenStreetMap misses many cafés; Overture Maps (open data from Meta,
-- Microsoft, Foursquare and others) lists far more. A region is bulk-imported
-- with scripts/overture/{export.py,prepare.mjs} and import_overture_places()
-- below, run by an operator (service role); the app keeps seeding everywhere
-- else from OSM on demand (migration 012).
--
-- Rows: [id, name, address, city, state, lat, lng, kind, descriptors], id like "ovm_<uuid>".
-- A place already in the catalog (OSM or earlier import) isn't added twice: an
-- existing place within 120 m with a similar name, or the same name within 40 m,
-- counts as the same café. A hand-typed café with no location and the same,
-- unambiguous name is adopted (it gains this one's address and map position).

do $$ begin
  alter table places drop constraint if exists places_source_check;
  alter table places add constraint places_source_check check (source in ('user', 'osm', 'overture'));
end $$;

create or replace function import_overture_places(p_app_id app_id, p_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  r         jsonb;
  pid       text;
  pname     text;
  plat      double precision;
  plng      double precision;
  pkind     text;
  pt        geography;
  existing  uuid;
  n_added   int := 0;
  n_known   int := 0;
  n_dupe    int := 0;
  n_adopt   int := 0;
  n_bad     int := 0;
begin
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) > 500 then
    raise exception 'expected an array of at most 500 rows' using errcode = '22023';
  end if;

  for r in select * from jsonb_array_elements(p_rows) loop
    pid   := r->>0;
    pname := left(trim(r->>1), 120);
    plat  := (r->>5)::double precision;
    plng  := (r->>6)::double precision;
    pkind := r->>7;
    if pid !~ '^ovm_[0-9a-f-]{8,64}$' or coalesce(pname, '') = ''
       or plat not between -90 and 90 or plng not between -180 and 180 or (plat = 0 and plng = 0)
       or pkind not in ('specialty', 'chain', 'casual') then
      n_bad := n_bad + 1;
      continue;
    end if;
    pt := st_point(plng, plat)::geography;

    -- Imported before: nothing to do.
    if exists (select 1 from places where app_id = p_app_id and google_place_id = pid) then
      n_known := n_known + 1;
      continue;
    end if;

    -- Already on the map under another source.
    if exists (
      select 1 from places p
      where p.app_id = p_app_id and (p.lat <> 0 or p.lng <> 0)
        and st_dwithin(p.location, pt, 120)
        and (similarity(lower(p.name), lower(pname)) >= 0.45
             or lower(p.name) like lower(pname) || '%' or lower(pname) like lower(p.name) || '%'
             or (st_dwithin(p.location, pt, 40) and similarity(lower(p.name), lower(pname)) >= 0.3))
    ) then
      n_dupe := n_dupe + 1;
      continue;
    end if;

    -- A hand-typed café with no location and exactly this name (not a chain,
    -- and the only one of that name in this batch): give it this location.
    existing := null;
    if pkind <> 'chain'
       and (select count(*) from jsonb_array_elements(p_rows) e where lower(trim(e->>1)) = lower(pname)) = 1 then
      select p.id into existing from places p
      where p.app_id = p_app_id and p.lat = 0 and p.lng = 0 and p.google_place_id is null
        and lower(p.name) = lower(pname)
      order by p.created_at limit 1;
    end if;
    if existing is not null then
      update places set google_place_id = pid, lat = plat, lng = plng,
             address = coalesce(nullif(r->>2, ''), address), city = coalesce(nullif(r->>3, ''), city),
             state = coalesce(nullif(r->>4, ''), state), updated_at = now()
      where id = existing;
      n_adopt := n_adopt + 1;
      continue;
    end if;

    insert into places (app_id, name, address, city, state, country, lat, lng, google_place_id, source,
                        kind, relevant, descriptors, classified_by, classified_at)
    values (p_app_id, pname, coalesce(r->>2, ''), coalesce(r->>3, ''), coalesce(r->>4, ''), 'US', plat, plng, pid, 'overture',
            pkind, true,
            coalesce(array(select left(d, 32) from jsonb_array_elements_text(coalesce(r->8, '[]')) d limit 8), '{}'), 'rules', now());
    n_added := n_added + 1;
  end loop;

  return jsonb_build_object('added', n_added, 'already_imported', n_known, 'duplicates', n_dupe, 'adopted', n_adopt, 'invalid', n_bad);
end;
$$;

-- Operators only: an import is a deliberate, reviewed step, not something the app does.
revoke all on function import_overture_places(app_id, jsonb) from public, anon, authenticated;
