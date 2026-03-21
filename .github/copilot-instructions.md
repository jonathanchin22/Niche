# Niche — Copilot Context

## Project Overview
This is **Niche**, a monorepo of three niche social review apps: **boba** (`@niche/boba`), **brew** (`@niche/brew`), and **slice** (`@niche/slice`). Each app is a standalone Next.js app with a shared packages layer. The stack is:

- **Framework**: Next.js (App Router) + TypeScript
- **Styling**: Tailwind CSS
- **Backend**: Supabase (auth + database)
- **Monorepo**: pnpm workspaces
- **Deployment**: Vercel (GitHub integration)

## Monorepo Structure
/apps
/boba       → @niche/boba (live at niche-boba.vercel.app)
/brew       → @niche/brew
/slice      → @niche/slice
/packages
/ui         → shared components
/db         → shared Supabase client + types
/config     → shared Tailwind/TS config

## Core Features Already Built
These exist in the boba app and should be replicated/adapted for brew and slice:

1. **Auth** — Supabase auth (email/password), session handling via middleware
2. **Log Review Flow** — 3-step wizard: (1) place search, (2) score/rating, (3) details + image upload
3. **Explore Page** — Discover places; includes community photo strips
4. **Friends Page** — Follow/unfollow users, friend activity feed
5. **Profile Page** — User's reviews, photo grid, feed/photo tab toggle
6. **Place Detail Page** — Reviews, ratings, community photos for a specific place
7. **Image Upload** — Upload slots in the log flow; images stored in Supabase Storage

## Features to Integrate
When helping implement new features, always:
- Check if a shared component can live in `packages/ui` rather than being duplicated per app
- Use the Supabase client from `packages/db`
- Keep TypeScript strict — run `pnpm --filter=@niche/[app] exec tsc --noEmit` before assuming it compiles
- Follow each app's design identity (see below)

### Features in progress / to build:
- [ ] **Notifications** — activity alerts (new follower, someone liked your review)
- [ ] **Search** — global search across places and users
- [ ] **Review likes/reactions** — like or react to a friend's review
- [ ] **Leaderboards / Top Places** — ranked lists by rating or review count
- [ ] **Map View** — explore places geographically (consider Mapbox or Google Maps)
- [ ] **Onboarding flow** — first-time user setup (username, taste preferences)
- [ ] **Badges / Achievements** — gamification for review milestones
- [ ] **Collections / Lists** — user-curated lists ("My favorites", "Want to try")
- [ ] **Direct sharing** — share a review or place via link or native share API

## Design Identities (do not mix these up)
Each app has a distinct visual language:

**Boba** — minimal, white background, deep green (`#1B4332`), sketch-style illustrations, clean sans-serif
**Brew (coffee)** — warm linen background, editorial feel, Cormorant Garamond italic display font, Space Mono for labels, asymmetric layouts
**Slice (pizza)** — warm parchment background, bold tomato red, Italian-American energy, bold display type

When generating UI for a specific app, respect its color palette and typographic voice. Do not reuse the same layout structure across all three — each should feel architecturally distinct.

## Supabase Conventions
- All DB queries go through the typed client in `packages/db`
- Row-level security is enabled — always write queries that respect the authenticated user's context
- Image uploads go to Supabase Storage buckets (one per app: `boba-images`, `brew-images`, `slice-images`)

## Deployment Notes
- Never suggest `vercel deploy` CLI — deployments happen via GitHub push
- Build command per app: `pnpm --filter=@niche/[app] build`
- Install command: `pnpm install --frozen-lockfile`
- Root Directory in Vercel: blank (monorepo root)

## Code Style
- Prefer server components where possible; use `'use client'` only when interactivity requires it
- Co-locate types with their feature (e.g. `app/reviews/types.ts`)
- Use Tailwind utility classes — no CSS modules or styled-components
- Avoid `any` — use proper Supabase-generated types from `packages/db/types.ts`