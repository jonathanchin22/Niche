-- ─── Place Saves / Collections ─────────────────────────────────────────────

create type place_save_list_type as enum ('favorites', 'want_to_try');

create table place_saves (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  place_id uuid not null references places(id) on delete cascade,
  app_id app_id not null,
  list_type place_save_list_type not null,
  created_at timestamptz not null default now(),
  unique (user_id, place_id, app_id, list_type)
);

alter table place_saves enable row level security;

create policy "Users can view own place saves"
  on place_saves for select using (auth.uid() = user_id);

create policy "Users can insert own place saves"
  on place_saves for insert with check (auth.uid() = user_id);

create policy "Users can delete own place saves"
  on place_saves for delete using (auth.uid() = user_id);

create index place_saves_user_app_idx on place_saves(user_id, app_id, list_type, created_at desc);
create index place_saves_place_id_idx on place_saves(place_id);
