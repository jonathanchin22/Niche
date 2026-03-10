-- ============================================================
-- NICHE — Triggers, Functions & RPC
-- Migration: 002_triggers_and_functions
-- ============================================================

-- ─── Auto-create profile on signup ───────────────────────────────────────────
-- When a user signs up via Supabase Auth, auto-create their profile row
-- and create the initial app_membership for the app they signed up through.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  source_app app_id;
begin
  -- Insert profile
  insert into public.profiles (id, email, username, display_name)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'username',
    new.raw_user_meta_data->>'display_name'
  );

  -- Create initial app membership for the app they signed up through
  begin
    source_app := (new.raw_user_meta_data->>'source_app_id')::app_id;
    insert into public.app_memberships (user_id, app_id)
    values (new.id, source_app);
  exception when others then
    -- source_app_id may be missing or invalid — safe to ignore
    null;
  end;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- ─── Update place avg_score and review_count after review changes ─────────────
create or replace function update_place_stats()
returns trigger
language plpgsql
security definer
as $$
declare
  p_id uuid;
begin
  -- Determine the place_id to update
  if TG_OP = 'DELETE' then
    p_id := old.place_id;
  else
    p_id := new.place_id;
  end if;

  update places
  set
    avg_score = (
      select round(avg(score)::numeric, 2)
      from reviews
      where place_id = p_id
    ),
    review_count = (
      select count(*)
      from reviews
      where place_id = p_id
    ),
    updated_at = now()
  where id = p_id;

  return null;
end;
$$;

create trigger on_review_changed
  after insert or update or delete on reviews
  for each row execute procedure update_place_stats();

-- ─── Award XP on review creation ─────────────────────────────────────────────
create or replace function award_review_xp()
returns trigger
language plpgsql
security definer
as $$
begin
  update app_memberships
  set xp = xp + 10
  where user_id = new.user_id
    and app_id = new.app_id;

  return null;
end;
$$;

create trigger on_review_created_award_xp
  after insert on reviews
  for each row execute procedure award_review_xp();

-- ─── Notification triggers ────────────────────────────────────────────────────

-- Notify on new like
create or replace function notify_review_like()
returns trigger
language plpgsql
security definer
as $$
declare
  review_author uuid;
begin
  select user_id into review_author
  from reviews where id = new.review_id;

  -- Don't notify yourself
  if review_author = new.user_id then
    return null;
  end if;

  insert into notifications (user_id, type, actor_id, review_id)
  values (review_author, 'review_like', new.user_id, new.review_id);

  return null;
end;
$$;

create trigger on_review_liked
  after insert on review_likes
  for each row execute procedure notify_review_like();

-- Notify on new comment
create or replace function notify_review_comment()
returns trigger
language plpgsql
security definer
as $$
declare
  review_author uuid;
begin
  select user_id into review_author
  from reviews where id = new.review_id;

  if review_author = new.user_id then
    return null;
  end if;

  insert into notifications (user_id, type, actor_id, review_id, comment_id)
  values (review_author, 'review_comment', new.user_id, new.review_id, new.id);

  return null;
end;
$$;

create trigger on_review_commented
  after insert on review_comments
  for each row execute procedure notify_review_comment();

-- Notify on new follower
create or replace function notify_new_follower()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into notifications (user_id, type, actor_id)
  values (new.following_id, 'new_follower', new.follower_id);

  return null;
end;
$$;

create trigger on_new_follower
  after insert on follows
  for each row execute procedure notify_new_follower();

-- ─── Map pins RPC ─────────────────────────────────────────────────────────────
-- Called by getMapPins() — returns places within bounds with friend context.
create or replace function get_map_pins(
  p_app_id    app_id,
  p_user_id   uuid,
  p_north     double precision,
  p_south     double precision,
  p_east      double precision,
  p_west      double precision
)
returns table (
  place           json,
  friend_count    bigint,
  friend_avatars  text[],
  top_score       numeric
)
language sql
stable
as $$
  select
    row_to_json(p.*) as place,
    count(distinct f.follower_id) as friend_count,
    array_agg(distinct pr.avatar_url) filter (where pr.avatar_url is not null) as friend_avatars,
    max(r.score) as top_score
  from places p
  left join reviews r on r.place_id = p.id
  left join follows f on f.following_id = r.user_id and f.follower_id = p_user_id
  left join profiles pr on pr.id = r.user_id
    and f.follower_id = p_user_id
  where
    p.app_id = p_app_id
    and p.lat between p_south and p_north
    and p.lng between p_west and p_east
  group by p.id
  order by friend_count desc, p.avg_score desc
  limit 50;
$$;

-- ─── updated_at auto-update ───────────────────────────────────────────────────
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_profiles_updated_at
  before update on profiles
  for each row execute procedure set_updated_at();

create trigger set_places_updated_at
  before update on places
  for each row execute procedure set_updated_at();

create trigger set_reviews_updated_at
  before update on reviews
  for each row execute procedure set_updated_at();
