-- Deterministic people and cups for the end-to-end tests. Dates are relative
-- to now() so "this week" / "before that" sections always have content.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000001', 'maya@example.com',   '{"username":"maya","display_name":"Maya","source_app_id":"brew"}'),
  ('00000000-0000-0000-0000-000000000002', 'priya@example.com',  '{"username":"priya","display_name":"Priya","source_app_id":"brew"}'),
  ('00000000-0000-0000-0000-000000000003', 'sam@example.com',    '{"username":"sam","display_name":"Sam","source_app_id":"brew"}'),
  ('00000000-0000-0000-0000-000000000004', 'jonah@example.com',  '{"username":"jonah","display_name":"Jonah","source_app_id":"brew"}'),
  ('00000000-0000-0000-0000-000000000008', 'leaving@example.com','{"username":"leaving","display_name":"Leaving Soon","source_app_id":"brew"}'),
  ('00000000-0000-0000-0000-000000000009', 'newbie@example.com', '{"username":"newbie","display_name":"New Person","source_app_id":"brew"}')
on conflict (id) do nothing;

insert into places (id, app_id, name, address, city, state, country, lat, lng, google_place_id) values
  ('10000000-0000-0000-0000-000000000001', 'brew', 'Sightglass', '270 7th St', 'San Francisco', 'CA', 'US', 37.7766, -122.4086, 'osm_node_1'),
  ('10000000-0000-0000-0000-000000000002', 'brew', 'Ritual', '1026 Valencia St', 'San Francisco', 'CA', 'US', 37.7564, -122.4213, 'osm_node_2'),
  ('10000000-0000-0000-0000-000000000003', 'brew', 'Blue Bottle', '66 Mint St', 'San Francisco', 'CA', 'US', 37.7823, -122.4073, 'osm_node_3')
on conflict (id) do nothing;

insert into follows (follower_id, following_id) values
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002'),
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003')
on conflict do nothing;

insert into reviews (id, app_id, user_id, place_id, score, item_name, category, note, tags, created_at) values
  -- maya's own cups (her ranking ladder)
  ('20000000-0000-0000-0000-000000000001', 'brew', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 9.2, 'Ethiopia pour over', 'pour over', 'floral, like tea', '{}', now() - interval '3 days'),
  ('20000000-0000-0000-0000-000000000002', 'brew', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 8.5, 'Cortado', 'cortado', null, '{}', now() - interval '12 days'),
  ('20000000-0000-0000-0000-000000000003', 'brew', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003', 7.8, 'Latte', 'latte', null, '{}', now() - interval '40 days'),
  -- friends
  ('20000000-0000-0000-0000-000000000011', 'brew', '00000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 8.9, 'Flat white', 'flat white', 'sat by the window', '{}', now() - interval '1 day'),
  ('20000000-0000-0000-0000-000000000012', 'brew', '00000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 8.1, 'Espresso', 'espresso', null, '{}', now() - interval '20 days'),
  ('20000000-0000-0000-0000-000000000021', 'brew', '00000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000003', 7.5, 'Iced latte', 'latte', null, '{}', now() - interval '90 days'),
  -- someone maya doesn't follow (community tier)
  ('20000000-0000-0000-0000-000000000031', 'brew', '00000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', 8.6, 'Gibraltar', 'gibraltar', 'barely there milk', '{}', now() - interval '2 days'),
  ('20000000-0000-0000-0000-000000000041', 'brew', '00000000-0000-0000-0000-000000000008', '10000000-0000-0000-0000-000000000002', 6.5, 'Mocha', 'mocha', null, '{}', now() - interval '5 days')
on conflict (id) do nothing;

update reviews set personal_rank = score where personal_rank is null;
