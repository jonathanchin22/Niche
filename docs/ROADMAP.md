# Niche: from hobby app to a habit people come back to

_Status (September 2026): the first slice has shipped (see "Progress" at the end). Everything else is planned._

## Context
brew and boba now work: redesigned UI, a friends feed, nearby cafés, a hardened database. But nothing brings people back after day one:
- **Empty first day.** A new user has no friends on the app, so the feed is blank or shows "from the archive".
- **Logging takes effort** and gives nothing back beyond a score.
- **Nothing pulls them back.** No push notifications, no rituals, no "you'll miss out".
- **Blind.** No analytics, so nobody can see where people drop off.

Decisions from the user:
- **Native iOS/Android.**
- **One app with niche "rooms",** only if it stays personal and uncongested.

Apps that retain well in this space each have one sharp loop:
- **Beli:** head-to-head ranking builds your personal list.
- **Letterboxd:** a diary plus yearly stats and lists.
- **Strava:** kudos, segments and weekly recaps.
- **Untappd:** check-ins at a venue, badges and venue leaderboards.
- **Duolingo:** streaks and well-timed push notifications.

Niche's version:
> **Log a cup in 10 seconds → it slots into your personal ranked list → friends react → you get pinged → weekly recap and "your taste" keep you logging.**

## North-star metrics (what "next level" means)
- **Activation:** within 24h of signup, logged 1 cup and follows 3 people. Target 40%+ of signups.
- **Retention:**
  - D1 at least 40%, D7 at least 20%, D30 at least 10%.
  - Weekly retention curve flattens by week 4.
- **Engagement:** logs per weekly active user per week of 2+, and 30%+ of logs get a social reaction within 24h.
- **Tracking:** all of these are reviewed weekly on a dashboard.

---

## Phase 0: See what's happening and meet production basics (1–2 weeks)
1. **Product analytics.** Add PostHog: events, funnels and retention cohorts; free tier.
   - Events: `signup`, `onboarding_step`, `niche_joined`, `cup_logged` (with photo?, time-to-log), `friend_followed`, `feed_viewed`, `cheer_sent`, `comment_sent`, `push_opened`, `invite_sent/accepted`.
   - Build one shared `track()` helper in a new `packages/analytics`, called from the existing write paths in `packages/database/src/index.ts` (`createReview`, `cheerReview`, `saveReview`, `followUser`).
2. **Errors and performance.** Add Sentry to the web apps now and native later.
3. **Tests in CI.** CI currently runs typecheck, lint and build only.
   - Playwright end-to-end tests for sign-up, logging a cup, the feed and cheers, against a Supabase branch database.
   - The local harness from this session already does this (Postgres + PostgREST + fake auth) and is a good template.
4. **Environments.** Use a Supabase staging branch; run migrations through the Supabase CLI in CI instead of pasting SQL. The files in `infrastructure/supabase/migrations/` are already idempotent.
5. **App Store requirements.** Apple and Google will reject the app without these, and they're good practice anyway:
   - In-app account deletion: a new `delete_my_account()` function, security definer, cascading.
   - Report and block for user-generated content (a new `reports` / `blocks` table, filtered in the feed queries).
   - Sign in with Apple, since Google sign-in exists.
   - A privacy policy and terms.
6. **Operations.** Point-in-time recovery backups; drop `backup_20260925`; enable leaked-password protection.

## Phase 1: Activation, a great first 5 minutes (3–4 weeks)
1. **Onboarding that ends with a full feed:**
   - Pick your niches. Each is a card with its own art and vibe, like joining a community.
   - Find friends: contacts import with hashed phone numbers and emails, plus "people from your city in this niche".
   - Log your first cup.
   - Land on a feed that already has content.
2. **The feed is never empty.** Extend `getHomeFeed` in `packages/database/src/index.ts` with a "near you" tier: popular cups from the user's city or area, which are public anyway. Label it clearly ("cups around Hayes Valley") so it never pretends to be friends.
3. **Invites that attribute.** Invite links (`/i/<code>`) that auto-follow both ways on signup, plus a "friends who joined" moment.
4. **Faster logging.** The flow becomes camera, drink, done:
   - The camera opens first.
   - The café is auto-picked from location. The existing `findNearbyPlaces` in `packages/database/src/nearby.ts` supplies the list; this adds choosing one automatically.
   - Drink autocomplete from the café's past logs.
   - Score, then save.
5. **Pairwise ranking (Beli's core mechanic).** After scoring, ask "better or worse than your Phin cortado?" two or three times.
   - This produces a personal ranked list per drink type, which is addictive and gives far better data than a raw 0–10.
   - Store it as `rank_position` or an Elo-style rating per user and category in a new migration. The 0–10 score stays visible.

## Phase 2: Native app plus push, the retention engine (4–6 weeks)
1. **Expo (React Native) in the monorepo** as `apps/mobile`.
   - It reuses `packages/database` (the query layer is plain supabase-js), `packages/shared-types` and `packages/auth` logic.
   - The Next.js apps stay for public share pages, SEO café pages and web sign-in.
   - Why Expo over wrapping the web apps in Capacitor: native camera, push, haptics, widgets and 60fps lists.
2. **Push notifications.** Expo Notifications, sent by a Supabase Edge Function fired from database webhooks on `notifications` inserts. The triggers already exist: `notify_new_follower`, `notify_review_comment`, `notify_review_saved` and the cheers trigger.
   - Social pushes: cheers, comments, a new follower, "priya saved your cortado".
   - Timely pushes: "a friend just logged at a café on your want-to-try list", "your friend is at Phin right now".
   - Guardrails: batching, quiet hours, per-type toggles, a daily cap. Over-notifying kills retention faster than silence.
3. **Home-screen widget:** "cup of the day" from friends, plus a one-tap log.
4. **"Log your drink" Live Activity when you're in a café.** On iOS the app shows up on the lock screen and in the Dynamic Island while you're in a café. Android gets an ongoing notification with a "log your drink" button.
   - **Detecting the visit, on the device.** Geofence up to 20 cafés that matter to you, re-picked on significant location changes as you move: ones you've logged at, your want-to-try list, and popular ones nearby. Location never leaves the phone.
   - **Only after a real stop.** Trigger after about 5 minutes inside. Skip it if you logged there today, respect quiet hours, and show it at most once a day.
   - **Starting it.** iOS only starts Live Activities from the background via push-to-start (iOS 17.2+). On arrival the app sends just the place id to a Supabase Edge Function, which sends the push. The activity ends when you leave, or after about 90 minutes.
   - **Content that earns the tap.** Café name, a friend's go-to there ("priya's go-to: cortado 8.9") and a "log your drink" button. The button deep-links to the log screen with the café picked and the camera open.
   - **Consent.** Needs "Always" location. Ask only after a few logs, with a preview of what they'll get. Add a per-café "not here" option and a toggle in settings. App Review scrutinises this permission, so the explanation text matters.
   - **Build notes.** Geofencing via `expo-location` plus `expo-task-manager`. The Live Activity is a small SwiftUI widget extension added through an Expo config plugin (e.g. `expo-apple-targets`); push-to-start tokens are stored per user.
   - **Needs** café coordinates. Places picked from the nearby list have them. Backfill the older hand-typed ones (lat/lng 0) by name search.
   - **Already on the web:** opening the log screen inside a café pre-selects it ("looks like you're here · not here?"). The events `cafe_autodetected` and `cafe_autodetect_rejected` measure how often it's right before the native version is built.

## Phase 3: Reasons to come back every week (ongoing)
1. **Weekly recap.** A Sunday push that opens a story-style recap: your cups, your top café, your friends' best find, and your rank changes.
2. **Streaks, framed kindly.** Weekly logging streaks with a freeze, not daily pressure. Boba is a weekly habit; coffee can be daily.
3. **Your taste profile.**
   - Built from the tags and `taste_attributes` already stored: "you like bright, fruity pour-overs; 72% oat milk; less-sweet boba".
   - Powers "you'd probably love…" café and drink suggestions.
4. **Place leaderboards and badges.**
   - "Top regular at Phin this month", "first to log Tiger Sugar in your crew", "tried 10 cafés".
   - The `app_memberships.xp` and `badges` columns already exist but are unused.
5. **Year-in-review "Wrapped."** Shareable, and the biggest organic growth moment of the year.
6. **Lists.** Build on the saves table (`review_saves`, migration 008): "want to try", "best study spots", "date-night boba". Lists can be public and followable.

## Phase 4: Growth loops
- **Share cards.** Every cup, list and recap renders to an Instagram-story or iMessage image through Next.js `ImageResponse` (OG images) on the web app, and deep-links back into the app.
- **Public café pages.** SEO pages like "Best cortado in Hayes Valley, ranked by locals" pull in search traffic.
- **Group challenges.** "Boba crawl: 5 shops this month" with friends.

## The "one app, many niches" design (the clever part)
The goal is one account, one friends list and one install, while every niche still feels like its own place.
- **Niche rooms, not one mixed feed.**
  - Home shows one niche at a time. A switcher sits at the top, like account switching in Instagram or servers in Discord.
  - Each room keeps its own brand. The theme tokens already differ: brew is editorial tan with Cormorant, boba is jade with DM Serif. The whole UI reskins per room.
- **Your niches only.** You see rooms you've joined. A friend's boba logs never show up in your coffee room. Cross-niche activity appears only on profiles and in a quiet "your friends are also into…" nudge.
- **Per-niche identity.** An optional different display name or bio per niche, and a niche-specific profile grid. This keeps it personal.
- **Engineering fit.** `app_id` is already first-class on `reviews`, `places` and `app_memberships`, so the data model needs almost nothing. It becomes one mobile shell that reads the room's theme and copy from a config per niche; today these live in `apps/{brew,boba}/src/lib/{brew,boba}.ts` plus the globals.css tokens.
- **Store presence.** If needed later, the same codebase can also ship branded single-niche store listings through build variants for App Store discovery.
- **New niches** (the `AppId` type already reserves `slice`, `ramen` and `pizza`) become a config plus a doodle set, not a new app.

## Production engineering (runs alongside the phases)
- **Place data.** OpenStreetMap is fine for starting out. Move to Foursquare or Google Places for better coverage, photos and hours, keeping OSM as a fallback in `nearby.ts`.
- **Photos.** Serve through an image CDN with resizing and blur-up placeholders: Supabase image transforms (Pro plan) or Cloudflare Images.
- **Feed at scale.** Cursor pagination and infinite scroll now. Later, a ranked feed that blends recency, closeness to the friend and place relevance.
- **Moderation.** Automated photo checks, a report queue, rate limits on comments and logs.
- **Offline.** Queue logs on mobile and sync when back online.

## Recommended first slice (what I'd build first, if approved)
Phase 0, items 1–5, plus Phase 1 items 2 and 5:
- Analytics
- Sentry
- Playwright tests in CI
- Account deletion plus report and block
- A feed that is never empty
- Pairwise ranking

Together these make the web apps measurable, store-ready and noticeably stickier before the native build starts.

## Verification
- **Analytics:** events show up in PostHog from a local run; the activation funnel and D1/D7 cohort dashboards exist.
- **Tests:** Playwright end-to-end tests run and pass in the CI workflow (`.github/workflows/ci.yml`).
- **Account deletion:** removes every row for the user, checked with SQL against staging.
- **Report and block:** blocked users' cups disappear from the feed.
- **Never-empty feed:** a brand-new account sees a populated feed (the "near you" tier), checked in a Playwright test.
- **Pairwise ranking:** after 3 comparisons the user's ranked list order matches their choices.
- **Security:** Supabase advisors stay clean after each migration.

## Progress
- **Done: first slice** ([PR #12](https://github.com/jonathanchin22/Niche/pull/12))
  - Analytics and Sentry (off until keys are set).
  - End-to-end tests in CI.
  - Account deletion, block and report (migration 011).
  - Settings, privacy and terms.
  - A never-empty feed (the "around brew/boba" section).
  - Pairwise ranking and the ranked tab.
- **Done: "you're at <café>" on the web**, the Phase 2 item 4 preview.
- **Done: Explore that's never empty.**
  - Areas are seeded from OpenStreetMap on first visit.
  - Every café near you appears, reviewed or not, with "be the first" prompts.
  - Search falls back to the map.
  - Unreviewed cafés get their own pages, with a "first logged by" credit.
  - A map in each app's colours (MapLibre + OpenFreeMap, no API key).
  - A Claude classification job, switched on once its keys are added.
- **Waiting on the owner:**
  - PostHog, Sentry and support email keys in Vercel.
  - Leaked-password protection in the Supabase dashboard.
  - Sign in with Apple (Apple developer account).
  - A legal read of the privacy and terms drafts.
  - A Supabase staging branch (needs a paid plan).
- **Next:**
  - Phase 1 onboarding, invite links and camera-first logging.
  - Then Phase 2, the native app with push.
