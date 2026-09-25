-- ============================================================
-- NICHE — Reconcile schema drift & fix database connection issues
-- Migration: 007_reconcile_schema_and_connection_fixes
-- ============================================================
-- Idempotent: safe to run on production (which has drifted from the
-- migration history — see current_schema_supabase.sql) and on fresh installs.
--
--   1. Columns the apps read/write that only exist in production.
--   2. A real unique index on places(app_id, google_place_id) so the
--      upsertPlace() fallback's ON CONFLICT target exists.
--   3. handle_new_user(): OAuth (Google/Apple) signups carry no `username`
--      in their metadata, which violated profiles.username NOT NULL and made
--      Supabase reject the signup with "Database error saving new user".
--   4. find_or_create_place(): places has no UPDATE policy, so under RLS the
--      "update existing place" branches silently did nothing. Run it as
--      security definer, callable by signed-in users only.
--   5. review-images storage bucket + policies (the 003 policy checks queried
--      columns that don't exist on pg_policies, so they never got created).

-- ─── 1. Columns used by the apps ─────────────────────────────────────────────
alter table profiles add column if not exists location text;

-- Legacy review text column; the apps now write `note` and only fall back to
-- `body` when reading. Copy any legacy text across so `note` is canonical.
alter table reviews add column if not exists body text;
update reviews set note = body where note is null and body is not null;

-- ─── 2. Unique (app_id, google_place_id) ─────────────────────────────────────
-- Consolidate existing duplicates first (oldest row wins), mirroring
-- deduplicate_places() from migration 006.
do $$
declare
  dup record;
  canonical_id uuid;
begin
  for dup in
    select app_id, google_place_id
    from   places
    where  google_place_id is not null
    group  by app_id, google_place_id
    having count(*) > 1
  loop
    select id into canonical_id
    from   places
    where  app_id = dup.app_id and google_place_id = dup.google_place_id
    order  by created_at asc
    limit  1;

    update reviews
    set    place_id = canonical_id
    where  place_id in (
      select id from places
      where  app_id = dup.app_id
        and  google_place_id = dup.google_place_id
        and  id <> canonical_id
    );

    delete from places
    where  app_id = dup.app_id
      and  google_place_id = dup.google_place_id
      and  id <> canonical_id;
  end loop;
end
$$;

create unique index if not exists places_app_id_google_place_id_idx
  on places (app_id, google_place_id);

-- Migration 006's name-based index, in case 006 was only partially applied.
create unique index if not exists places_app_id_name_no_gid_idx
  on places (app_id, lower(name))
  where google_place_id is null;

-- Keep avg_score / review_count correct for places that absorbed duplicates.
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

-- ─── 3. Robust profile creation on signup ────────────────────────────────────
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

  insert into public.profiles (id, email, username, display_name, avatar_url)
  values (
    new.id,
    new.email,
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

-- ─── 4. find_or_create_place as security definer ─────────────────────────────
-- Same body as migration 006; only the security context changes.
create or replace function find_or_create_place(
  p_app_id          app_id,
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
security definer set search_path = public
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'must be signed in to create places' using errcode = '42501';
  end if;

  if p_google_place_id is not null then
    select id into v_id
    from   places
    where  app_id          = p_app_id
      and  google_place_id = p_google_place_id
    limit  1;

    if v_id is not null then
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

    insert into places
      (app_id, name, address, city, state, country, lat, lng,
       google_place_id, foursquare_id, cover_image_url)
    values
      (p_app_id, p_name, p_address, p_city, p_state, p_country, p_lat, p_lng,
       p_google_place_id, p_foursquare_id, p_cover_image_url)
    on conflict (app_id, google_place_id) do update set updated_at = now()
    returning id into v_id;

    return v_id;
  end if;

  select id into v_id
  from   places
  where  app_id          = p_app_id
    and  lower(name)     = lower(p_name)
    and  google_place_id is null
  limit  1;

  if v_id is not null then
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

revoke all on function find_or_create_place(app_id, text, text, text, text, text, double precision, double precision, text, text, text) from public, anon;
grant execute on function find_or_create_place(app_id, text, text, text, text, text, double precision, double precision, text, text, text) to authenticated;

-- ─── 5. review-images storage bucket & policies ──────────────────────────────
insert into storage.buckets (id, name, public)
values ('review-images', 'review-images', true)
on conflict (id) do nothing;

drop policy if exists "Users can upload review images" on storage.objects;
create policy "Users can upload review images"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'review-images');

drop policy if exists "Review images are publicly readable" on storage.objects;
create policy "Review images are publicly readable"
  on storage.objects for select
  using (bucket_id = 'review-images');

-- Ask PostgREST to pick up the new columns/functions immediately.
notify pgrst, 'reload schema';
