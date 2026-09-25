# niche

> A suite of niche social review apps — each its own world, one shared account.

**Apps:**
| App | Description | URL |
|-----|-------------|-----|
| `brew.` | Coffee & café reviews | `brew.niche.app` |
| `boba!` | Bubble tea reviews | `boba.niche.app` |
| `slice.` | Pizza reviews | `slice.niche.app` |

**The key idea:** Each app is a fully distinct brand and experience. But users sign up once — joining a second app is a single tap ("Continue as Maya →"), and your social graph carries over.

---

## Architecture

```
niche/
├── apps/
│   ├── brew/          # Next.js 14 app (App Router)
│   ├── boba/          # Next.js 14 app (App Router)
│   └── slice/         # Next.js 14 app (App Router)
├── packages/
│   ├── shared-types/  # TypeScript types shared across all apps
│   ├── auth/          # Shared Supabase auth helpers
│   ├── database/      # Shared query functions
│   ├── ui/            # Shared React component primitives
│   └── config/        # Shared ESLint, TS, Tailwind configs
└── infrastructure/
    └── supabase/
        ├── migrations/ # All DB migrations (run in order)
        └── seed/       # Dev seed data
```

### Tech stack

| Layer | Choice | Why |
|-------|--------|-----|
| Framework | Next.js 14 (App Router) | Server components = fast initial loads; file-based routing |
| Monorepo | Turborepo + pnpm workspaces | Shared packages with zero duplication |
| Database | Supabase (Postgres) | Auth + DB + realtime + storage in one; row-level security |
| Auth | Supabase Auth | OAuth (Google/Apple), magic link, shared across all apps |
| State | React Query v5 | Server state, caching, optimistic updates |
| Maps | MapLibre GL (free) + Google Places API (autocomplete only) | No per-tile cost |
| Styling | Tailwind CSS (per-app tokens) | Each app has its own color/font tokens |
| Deployment | Vercel (one project per app) | Preview URLs on every PR |

### Database key design decisions

- **One `profiles` table** — shared user identity, no duplication
- **`app_memberships` table** — tracks which apps a user has joined + per-app XP/badges
- **`follows` are global** — follow once, friend appears across all apps
- **`places` are per-app** — a Gong Cha in the boba database is a separate row from (hypothetically) the same location in another app
- **Row Level Security on every table** — enforced at the DB level, not just the API

---

## Getting started

### Prerequisites
- Node.js 20+
- pnpm 9+ (`npm install -g pnpm`)
- Supabase CLI (`brew install supabase/tap/supabase`)

### 1. Clone and install

```bash
git clone https://github.com/YOUR_USERNAME/niche.git
cd niche
pnpm install
```

### 2. Set up Supabase locally

```bash
# Start local Supabase (Docker required)
supabase start

# Run migrations
supabase db push

# Seed with sample data
supabase db reset --db-url postgresql://postgres:postgres@localhost:54322/postgres
```

### Applying migrations to an existing (production) project

Production has drifted from the migration history at times (see `current_schema_supabase.sql`).
Migration `007_reconcile_schema_and_connection_fixes.sql` is idempotent and brings any environment
back in line — paste it into the Supabase SQL editor if you don't use `supabase db push`.

The brew redesign also needs `008_want_to_try_and_social.sql` ("want to try" saves, save notifications,
and public app memberships for friend suggestions). Run 007 first, then 008.

### 3. Configure environment variables

```bash
# Copy the example env for the app you're working on
cp apps/boba/.env.example apps/boba/.env.local
# Fill in your Supabase URL and keys (shown after `supabase start`)
```

### 4. Run dev server

```bash
# Run all apps at once
pnpm dev

# Or run just boba
pnpm dev --filter=@niche/boba
```

Apps run at:
- `brew` → http://localhost:3000
- `boba` → http://localhost:3001
- `slice` → http://localhost:3002

---

## Deployment

Each app deploys independently to Vercel. Deployments are triggered automatically on push to `main`.

### First-time setup (do once per app)

```bash
# Install Vercel CLI
npm i -g vercel

# Link boba to Vercel
cd apps/boba
vercel link

# Add environment variables
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
vercel env add SUPABASE_SERVICE_ROLE_KEY
vercel env add NEXT_PUBLIC_GOOGLE_PLACES_API_KEY
```

### Deploy

```bash
# Deploy boba to production
cd apps/boba
vercel --prod
```

### Adding a new app (e.g. `ramen`)

1. Add `"ramen"` to the `app_id` enum in `001_initial_schema.sql` and create a new migration
2. `cp -r apps/boba apps/ramen`
3. Update `apps/ramen/next.config.js` — set `NEXT_PUBLIC_APP_ID: "ramen"`
4. Update colors/fonts in `tailwind.config.js`
5. Add `ramen` to the `APPS` list in `packages/shared-types/src/index.ts`
6. Create a new Vercel project pointing to `apps/ramen`

---

## Project conventions

- **Server components by default** — only add `"use client"` when you need interactivity
- **Optimistic updates everywhere** — likes, follows, etc. should feel instant
- **Types first** — all data shapes live in `@niche/shared-types`
- **No secrets in code** — all API keys go in `.env.local` (gitignored)
- **Migrations are append-only** — never edit a migration that's been run in production; always add a new one

---

## Contributing

1. Create a branch: `git checkout -b feat/your-feature`
2. Make changes, ensure `pnpm typecheck` and `pnpm lint` pass
3. Open a PR — Vercel will auto-deploy a preview URL
