-- ============================================================
-- NICHE — Invite links
-- Migration: 015_invites
-- ============================================================
-- Idempotent.
-- Every person gets one private invite link (/i/<code>). Someone who signs up
-- from it follows the inviter and is followed back, so their first feed already
-- has a friend in it, and the inviter sees "joined from your invite".
--
--   invites             one code per person, minted on first use. Private:
--                       a code is only ever read by its owner (or resolved to
--                       a name by get_invite), so nobody can scrape codes to
--                       collect follow-backs.
--   invite_redemptions  who joined from whose link. One row per invitee.
--
-- Guardrails on the automatic follow-back:
--   * only for accounts younger than 14 days, and only once per person;
--   * never between people who have blocked each other;
--   * at most 25 follow-backs per inviter per day.
-- Anyone else who opens a link (an existing member) just follows the inviter,
-- which they could do from the profile anyway.

-- ─── Tables ──────────────────────────────────────────────────────────────────
create table if not exists invites (
  user_id     uuid primary key references profiles(id) on delete cascade,
  code        text not null unique check (code ~ '^[a-z0-9]{6,16}$'),
  created_at  timestamptz not null default now()
);

alter table invites enable row level security;

drop policy if exists "Users see their own invite code" on invites;
create policy "Users see their own invite code"
  on invites for select using ((select auth.uid()) = user_id);
-- No insert/update policies: codes are minted by my_invite_code() only.

create table if not exists invite_redemptions (
  invitee_id  uuid primary key references profiles(id) on delete cascade,
  inviter_id  uuid not null references profiles(id) on delete cascade,
  app_id      app_id not null,
  created_at  timestamptz not null default now(),
  check (invitee_id <> inviter_id)
);

alter table invite_redemptions enable row level security;

drop policy if exists "Inviter and invitee see the redemption" on invite_redemptions;
create policy "Inviter and invitee see the redemption"
  on invite_redemptions for select
  using ((select auth.uid()) in (invitee_id, inviter_id));

create index if not exists invite_redemptions_inviter_idx on invite_redemptions(inviter_id, created_at desc);

-- ─── Codes ───────────────────────────────────────────────────────────────────
-- 8 characters from an alphabet without look-alikes (no i, l, o, 0, 1):
-- easy to read aloud, ~10^12 possibilities, random bits from gen_random_uuid().
create schema if not exists private;

create or replace function private.new_invite_code()
returns text
language plpgsql
volatile
as $$
declare
  alphabet constant text := 'abcdefghjkmnpqrstuvwxyz23456789';
  bits     bigint := ('x' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 15))::bit(60)::bigint;
  code     text := '';
begin
  for i in 1..8 loop
    code := code || substr(alphabet, 1 + (bits % 31)::int, 1);
    bits := bits / 31;
  end loop;
  return code;
end;
$$;

revoke all on function private.new_invite_code() from public, anon, authenticated;

-- The signed-in person's code, minted the first time they ask for it.
create or replace function my_invite_code()
returns text
language plpgsql
security definer set search_path = public
as $$
declare
  me uuid := auth.uid();
  c  text;
begin
  if me is null then
    raise exception 'must be signed in' using errcode = '42501';
  end if;

  select code into c from invites where user_id = me;
  if c is not null then
    return c;
  end if;

  loop
    begin
      insert into invites (user_id, code) values (me, private.new_invite_code())
      on conflict (user_id) do nothing;
      exit;
    exception when unique_violation then
      -- Another person already has this code; draw again.
    end;
  end loop;

  select code into c from invites where user_id = me;
  return c;
end;
$$;

revoke all on function my_invite_code() from public, anon;
grant execute on function my_invite_code() to authenticated;

-- Who a link is from, for the invite page (signed out too). Unknown codes and
-- people who have blocked each other get nothing back.
create or replace function get_invite(p_code text)
returns table (id uuid, username text, display_name text, avatar_url text)
language sql
stable
security definer set search_path = public
as $$
  select p.id, p.username, p.display_name, p.avatar_url
  from invites i
  join profiles p on p.id = i.user_id
  where i.code = lower(btrim(p_code))
    and not private.is_blocked_between(auth.uid(), p.id);
$$;

revoke all on function get_invite(text) from public;
grant execute on function get_invite(text) to anon, authenticated;

-- Accept an invite: follow the inviter, and (for new accounts, once) be
-- followed back. Returns null for an unknown or blocked link.
create or replace function accept_invite(p_code text, p_app_id app_id)
returns json
language plpgsql
security definer set search_path = public
as $$
declare
  me        uuid := auth.uid();
  inviter   profiles%rowtype;
  joined_at timestamptz;
  credited  boolean := false;
begin
  if me is null then
    raise exception 'must be signed in' using errcode = '42501';
  end if;

  select p.* into inviter
  from invites i join profiles p on p.id = i.user_id
  where i.code = lower(btrim(p_code));

  if inviter.id is null or private.is_blocked_between(me, inviter.id) then
    return null;
  end if;

  if inviter.id = me then
    return json_build_object('status', 'self', 'username', inviter.username);
  end if;

  insert into follows (follower_id, following_id) values (me, inviter.id)
  on conflict do nothing;

  select created_at into joined_at from profiles where id = me;

  if joined_at > now() - interval '14 days'
     and not exists (select 1 from invite_redemptions where invitee_id = me)
     and (select count(*) from invite_redemptions
          where inviter_id = inviter.id and created_at > now() - interval '1 day') < 25
  then
    insert into invite_redemptions (invitee_id, inviter_id, app_id)
    values (me, inviter.id, p_app_id)
    on conflict (invitee_id) do nothing;
    insert into follows (follower_id, following_id) values (inviter.id, me)
    on conflict do nothing;
    credited := true;
  end if;

  return json_build_object(
    'status', 'ok',
    'id', inviter.id,
    'username', inviter.username,
    'display_name', inviter.display_name,
    'avatar_url', inviter.avatar_url,
    'credited', credited,
    'mutual', exists (select 1 from follows where follower_id = inviter.id and following_id = me)
  );
end;
$$;

revoke all on function accept_invite(text, app_id) from public, anon;
grant execute on function accept_invite(text, app_id) to authenticated;

notify pgrst, 'reload schema';
