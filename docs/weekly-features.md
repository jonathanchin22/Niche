# Weekly features

One user-facing improvement a week for boba and brew. Newest first.

## 2026-11-21 — Invite links (boba + brew)
- **Feature:** a personal invite link (`/i/<code>`) on the Friends page, with a share sheet or copy button.
  - The link opens a page showing who sent it and their top 3 cups, with one button to join.
  - After sign-up, the new person and the inviter follow each other.
  - The new person sees "you follow each other now", and their home starts with the inviter's cups.
  - The inviter sees "joined from your invite" in activity, and who joined on the invite card.
- **Why it matters:** the empty first day is the roadmap's biggest problem.
  - Someone joining from a friend's link now lands on a feed that already has that friend's cups, not a blank welcome.
  - It brings friends in without a noisy social feed: links are private, with no public invite counts and no nagging.
  - Roadmap Phase 1 item 3.
- **PR:** https://github.com/jonathanchin22/Niche/pull/23
- **Jon to do:** apply **migration `015_invites.sql`** to Supabase.
  - Until it's applied, the invite card stays hidden and nothing else changes.
  - No new env vars.
- **Caveats and follow-ups:**
  - Verification:
    - `pnpm install`, typecheck, lint and build couldn't run in the weekly sandbox because the npm registry was blocked, so rely on PR CI.
    - The migration was tested by hand against local Postgres.
  - Abuse guardrails on the automatic follow-back:
    - only accounts under 14 days old, once per person;
    - none between blocked pairs;
    - 25 a day per inviter.
  - Next:
    - an image share card for the link (Phase 4);
    - "friends who joined" as a push once the native app exists.
