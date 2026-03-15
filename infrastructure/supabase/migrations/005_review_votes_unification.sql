-- ============================================================
-- NICHE — Review vote model unification
-- Migration: 005_review_votes_unification
-- ============================================================

-- Canonical vote table for all apps. vote = 1 (upvote), -1 (downvote).
create table if not exists review_votes (
  review_id   uuid not null references reviews(id) on delete cascade,
  user_id     uuid not null references profiles(id) on delete cascade,
  vote        smallint not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  primary key (review_id, user_id),
  constraint review_votes_vote_check check (vote in (-1, 1))
);

alter table review_votes enable row level security;

-- Read visibility matches review_likes.
drop policy if exists "Votes are public" on review_votes;
create policy "Votes are public"
  on review_votes for select using (true);

drop policy if exists "Users can cast own vote" on review_votes;
create policy "Users can cast own vote"
  on review_votes for insert with check (auth.uid() = user_id);

drop policy if exists "Users can update own vote" on review_votes;
create policy "Users can update own vote"
  on review_votes for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users can remove own vote" on review_votes;
create policy "Users can remove own vote"
  on review_votes for delete using (auth.uid() = user_id);

create index if not exists review_votes_review_id_idx on review_votes(review_id);
create index if not exists review_votes_user_id_idx on review_votes(user_id);
create index if not exists review_votes_review_id_vote_idx on review_votes(review_id, vote);

-- Keep updated_at accurate when toggling vote values via upsert.
drop trigger if exists set_review_votes_updated_at on review_votes;
create trigger set_review_votes_updated_at
  before update on review_votes
  for each row execute procedure set_updated_at();

-- Backfill legacy likes as upvotes to keep historical engagement.
-- Some environments may not have review_likes (fresh installs / prior cleanup).
do $$
begin
  if to_regclass('public.review_likes') is not null then
    insert into review_votes (review_id, user_id, vote)
    select review_id, user_id, 1
    from review_likes
    on conflict (review_id, user_id) do nothing;
  end if;
end
$$;

-- Mirror existing like notification behavior for upvotes only.
create or replace function notify_review_upvote()
returns trigger
language plpgsql
security definer
as $$
declare
  review_author uuid;
begin
  if new.vote <> 1 then
    return null;
  end if;

  select user_id into review_author
  from reviews where id = new.review_id;

  if review_author = new.user_id then
    return null;
  end if;

  insert into notifications (user_id, type, actor_id, review_id)
  values (review_author, 'review_like', new.user_id, new.review_id);

  return null;
end;
$$;

drop trigger if exists on_review_upvoted on review_votes;

create trigger on_review_upvoted
  after insert on review_votes
  for each row execute procedure notify_review_upvote();
