-- ============================================================
-- NICHE — Core Database Schema
-- Migration: 001_initial_schema
-- ============================================================

-- Enable extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pg_trgm";     -- fuzzy search
create extension if not exists "postgis";     -- geospatial (for map queries)

-- ─── App IDs ────────────────────────────────────────────────────────────────
create type app_id as enum ('brew', 'boba', 'slice', 'ramen', 'pizza');

-- ─── Profiles ───────────────────────────────────────────────────────────────
-- One row per user, shared across all apps.
-- Linked to auth.users via foreign key.
create table profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  email         text not null unique,
  username      text not null unique,
  display_name  text not null,
  avatar_url    text,
  bio           text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint username_length check (char_length(username) between 2 and 30),
  constraint username_format check (username ~ '^[a-z0-9_.]+$')
);

alter table profiles enable row level security;

create policy "Public profiles are viewable by everyone"
  on profiles for select using (true);

create policy "Users can update own profile"
  on profiles for update using (auth.uid() = id);

-- ─── App Memberships ────────────────────────────────────────────────────────
-- Tracks which niche apps each user has joined.
create table app_memberships (
  user_id     uuid not null references profiles(id) on delete cascade,
  app_id      app_id not null,
  joined_at   timestamptz not null default now(),
  xp          integer not null default 0,
  badges      jsonb not null default '[]',

  primary key (user_id, app_id)
);

alter table app_memberships enable row level security;

create policy "Users can view own memberships"
  on app_memberships for select using (auth.uid() = user_id);

create policy "Users can insert own memberships"
  on app_memberships for insert with check (auth.uid() = user_id);

create policy "Users can update own memberships"
  on app_memberships for update using (auth.uid() = user_id);

-- ─── Follows ────────────────────────────────────────────────────────────────
-- Global follow graph — follow once, friend appears across all apps.
create table follows (
  follower_id   uuid not null references profiles(id) on delete cascade,
  following_id  uuid not null references profiles(id) on delete cascade,
  created_at    timestamptz not null default now(),

  primary key (follower_id, following_id),
  constraint no_self_follow check (follower_id != following_id)
);

alter table follows enable row level security;

create policy "Follows are public"
  on follows for select using (true);

create policy "Users can follow others"
  on follows for insert with check (auth.uid() = follower_id);

create policy "Users can unfollow"
  on follows for delete using (auth.uid() = follower_id);

-- ─── Places ─────────────────────────────────────────────────────────────────
create table places (
  id                uuid primary key default uuid_generate_v4(),
  app_id            app_id not null,
  name              text not null,
  address           text not null,
  city              text not null,
  state             text not null,
  country           text not null default 'US',
  lat               double precision not null,
  lng               double precision not null,
  location          geography(point, 4326) generated always as (
                      st_point(lng, lat)::geography
                    ) stored,
  google_place_id   text,
  foursquare_id     text,
  cover_image_url   text,
  avg_score         numeric(4,2),   -- updated by trigger on review insert/update
  review_count      integer not null default 0,
  fts               tsvector generated always as (
                      to_tsvector('english', name || ' ' || coalesce(city, '') || ' ' || coalesce(state, ''))
                    ) stored,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  unique (app_id, google_place_id)
);

alter table places enable row level security;

create policy "Places are viewable by everyone"
  on places for select using (true);

create policy "Authenticated users can create places"
  on places for insert with check (auth.role() = 'authenticated');

create index places_location_idx on places using gist(location);
create index places_fts_idx on places using gin(fts);
create index places_app_id_idx on places(app_id);

-- ─── Reviews ────────────────────────────────────────────────────────────────
create table reviews (
  id            uuid primary key default uuid_generate_v4(),
  app_id        app_id not null,
  user_id       uuid not null references profiles(id) on delete cascade,
  place_id      uuid not null references places(id) on delete cascade,
  score         numeric(4,2) not null,
  category      text,
  item_name     text,
  note          text,
  tags          text[] not null default '{}',
  image_urls    text[] not null default '{}',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint score_range check (score >= 0 and score <= 10)
);

alter table reviews enable row level security;

create policy "Reviews are public"
  on reviews for select using (true);

create policy "Users can create own reviews"
  on reviews for insert with check (auth.uid() = user_id);

create policy "Users can update own reviews"
  on reviews for update using (auth.uid() = user_id);

create policy "Users can delete own reviews"
  on reviews for delete using (auth.uid() = user_id);

create index reviews_app_id_user_id_idx on reviews(app_id, user_id);
create index reviews_place_id_idx on reviews(place_id);
create index reviews_created_at_idx on reviews(created_at desc);

-- ─── Review Likes ────────────────────────────────────────────────────────────
create table review_likes (
  review_id   uuid not null references reviews(id) on delete cascade,
  user_id     uuid not null references profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),

  primary key (review_id, user_id)
);

alter table review_likes enable row level security;

create policy "Likes are public"
  on review_likes for select using (true);

create policy "Users can like"
  on review_likes for insert with check (auth.uid() = user_id);

create policy "Users can unlike"
  on review_likes for delete using (auth.uid() = user_id);

-- ─── Review Comments ─────────────────────────────────────────────────────────
create table review_comments (
  id          uuid primary key default uuid_generate_v4(),
  review_id   uuid not null references reviews(id) on delete cascade,
  user_id     uuid not null references profiles(id) on delete cascade,
  body        text not null,
  created_at  timestamptz not null default now(),

  constraint comment_length check (char_length(body) between 1 and 500)
);

alter table review_comments enable row level security;

create policy "Comments are public"
  on review_comments for select using (true);

create policy "Users can comment"
  on review_comments for insert with check (auth.uid() = user_id);

create policy "Users can delete own comments"
  on review_comments for delete using (auth.uid() = user_id);

-- ─── Notifications ───────────────────────────────────────────────────────────
create type notification_type as enum (
  'new_follower', 'review_like', 'review_comment', 'badge_earned'
);

create table notifications (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null references profiles(id) on delete cascade,
  type            notification_type not null,
  actor_id        uuid references profiles(id) on delete set null,
  review_id       uuid references reviews(id) on delete cascade,
  comment_id      uuid references review_comments(id) on delete cascade,
  badge_id        text,
  read            boolean not null default false,
  created_at      timestamptz not null default now()
);

alter table notifications enable row level security;

create policy "Users can view own notifications"
  on notifications for select using (auth.uid() = user_id);

create policy "Users can update own notifications"
  on notifications for update using (auth.uid() = user_id);

create index notifications_user_id_idx on notifications(user_id, created_at desc);
