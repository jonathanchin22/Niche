-- ============================================================
-- NICHE — Development Seed Data
-- Run: supabase db seed (or paste into Supabase SQL editor)
-- ============================================================

-- ─── Demo users (passwords all "password123" for dev) ────────────────────────
-- Note: In real usage, users are created via auth.users.
-- For local dev, use Supabase Studio to create auth users,
-- then these profiles will be created by the trigger.
-- This seed assumes the trigger has already run.

-- ─── Demo places ─────────────────────────────────────────────────────────────
insert into places (app_id, name, address, city, state, lat, lng, google_place_id) values
  -- Boba
  ('boba', 'Xing Fu Tang',          '83-47 Broadway', 'Flushing',    'NY',  40.7424, -73.8947, 'ChIJxingfutang'),
  ('boba', 'Happy Lemon',           '3616 W 6th St',  'Los Angeles', 'CA',  34.0563, -118.2978, 'ChIJhappylemon'),
  ('boba', 'Gong Cha',              '16 W 45th St',   'New York',    'NY',  40.7560, -73.9806, 'ChIJgongcha'),
  ('boba', 'Tiger Sugar',           '135 W 41st St',  'New York',    'NY',  40.7545, -73.9883, 'ChIJtigersugar'),
  ('boba', 'Boba Guys',             '11 Waverly Pl',  'New York',    'NY',  40.7299, -73.9968, 'ChIJbobaguys'),
  -- Brew
  ('brew', 'Verve Coffee Roasters', '1540 Pacific Ave', 'Santa Cruz', 'CA', 36.9763, -122.0200, 'ChIJvervecoffee'),
  ('brew', 'Intelligentsia',        '3922 Sunset Blvd', 'Los Angeles', 'CA', 34.0891, -118.2610, 'ChIJintelligentsia'),
  -- Slice
  ('slice', 'Di Fara Pizza',        '1424 Avenue J',  'Brooklyn',    'NY',  40.6254, -73.9612, 'ChIJdifara')
on conflict (app_id, google_place_id) do nothing;
