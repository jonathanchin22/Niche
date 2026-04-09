# Scripts

## `seed-places.ts` — Seed cafes & boba shops from Nominatim

Queries the [Nominatim](https://nominatim.openstreetmap.org/) geocoding API (OpenStreetMap)
for cafes and boba tea shops, then upserts them into your Supabase `places` table.

### Prerequisites

Install [tsx](https://github.com/privatenumber/tsx) globally (or use `npx`):
```bash
npm install -g tsx
# or just prefix with: npx tsx
```

### Usage

```bash
# Set env vars (or copy to a .env file and source it)
export SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_SERVICE_KEY="your-service-role-key"   # preferred (bypasses RLS)
# or
export SUPABASE_ANON_KEY="your-anon-key"              # fallback

# Seed all default cities (both brew + boba)
npx tsx scripts/seed-places.ts

# Seed a specific city only
npx tsx scripts/seed-places.ts --city "Austin, TX"

# Seed only cafes (brew app)
npx tsx scripts/seed-places.ts --type brew

# Seed only boba shops
npx tsx scripts/seed-places.ts --type boba

# Combine flags
npx tsx scripts/seed-places.ts --city "Seattle, WA" --type boba
```

### Default cities
San Francisco CA · New York NY · Los Angeles CA · Chicago IL · Seattle WA · Austin TX · Boston MA · Portland OR

### Notes
- Uses `nominatim_<osm_id>` as `google_place_id` to deduplicate across runs.
- Respects Nominatim's 1 req/s rate limit automatically.
- Places already in Supabase are skipped (`ON CONFLICT DO NOTHING`).
