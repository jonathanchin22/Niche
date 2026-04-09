#!/usr/bin/env node
/**
 * scripts/seed-places.ts
 *
 * Queries the Nominatim (OpenStreetMap) API for cafes and boba/bubble-tea shops
 * across a list of cities and upserts them into Supabase.
 *
 * Usage:
 *   SUPABASE_URL=https://xxx.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key \
 *   npx tsx scripts/seed-places.ts
 *
 * Optional env vars:
 *   SEED_DELAY_MS   — milliseconds between Nominatim requests (default 1100)
 *   SEED_LIMIT      — max results per query (default 10)
 */

import { createClient } from "@supabase/supabase-js"

// ─── Config ──────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error(
    "❌  Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_KEY) before running."
  )
  process.exit(1)
}

const DELAY_MS = Number(process.env.SEED_DELAY_MS ?? 1100)
const LIMIT = Number(process.env.SEED_LIMIT ?? 10)

// Cities to search. Add or remove cities as needed.
const CITIES = [
  "New York, NY",
  "Los Angeles, CA",
  "San Francisco, CA",
  "Chicago, IL",
  "Seattle, WA",
  "Houston, TX",
  "Boston, MA",
  "Philadelphia, PA",
  "Austin, TX",
  "Portland, OR",
]

// Search terms per app
const SEARCHES: { app_id: "boba" | "brew"; keyword: string }[] = [
  // Boba / bubble tea shops
  { app_id: "boba", keyword: "bubble tea" },
  { app_id: "boba", keyword: "boba tea" },
  { app_id: "boba", keyword: "milk tea" },
  // Cafes / coffee shops
  { app_id: "brew", keyword: "cafe" },
  { app_id: "brew", keyword: "coffee shop" },
]

// ─── Types ───────────────────────────────────────────────────────────────────

interface NominatimPlace {
  osm_id: number
  display_name: string
  name: string
  lat: string
  lon: string
  address?: {
    road?: string
    house_number?: string
    city?: string
    town?: string
    village?: string
    state?: string
    country_code?: string
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function fetchNominatim(keyword: string, city: string): Promise<NominatimPlace[]> {
  const q = encodeURIComponent(`${keyword} ${city}`)
  const url = `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=${LIMIT}&addressdetails=1`

  const res = await fetch(url, {
    headers: {
      // Nominatim requires a meaningful User-Agent
      "User-Agent": "Niche-SeedScript/1.0 (github.com/jonathanchin22/Niche)",
    },
  })

  if (!res.ok) {
    console.warn(`  ⚠️  Nominatim ${res.status} for "${keyword} ${city}"`)
    return []
  }

  return (await res.json()) as NominatimPlace[]
}

function buildAddress(p: NominatimPlace): string {
  const a = p.address
  if (!a) return p.display_name
  const parts = [
    a.house_number ? `${a.house_number} ${a.road ?? ""}`.trim() : (a.road ?? ""),
  ].filter(Boolean)
  return parts.join(", ") || p.display_name.split(",").slice(0, 2).join(",").trim()
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const supabase = createClient(SUPABASE_URL!, SUPABASE_KEY!)

  let inserted = 0
  let skipped = 0

  for (const city of CITIES) {
    for (const { app_id, keyword } of SEARCHES) {
      console.log(`🔍  Searching "${keyword}" in ${city} (app: ${app_id})…`)

      const places = await fetchNominatim(keyword, city)

      for (const p of places) {
        // Skip results without a meaningful name
        const name = (p.name || p.display_name.split(",")[0]).trim()
        if (!name) continue

        const address = buildAddress(p)
        const cityVal =
          p.address?.city ?? p.address?.town ?? p.address?.village ?? ""
        const state = p.address?.state ?? ""
        const country = (p.address?.country_code ?? "us").toUpperCase()
        const google_place_id = `nominatim_${p.osm_id}`
        const lat = parseFloat(p.lat)
        const lng = parseFloat(p.lon)

        // Use the find_or_create_place RPC when available; otherwise direct upsert
        const { data: placeId, error: rpcError } = await supabase.rpc(
          "find_or_create_place",
          {
            p_app_id: app_id,
            p_name: name,
            p_address: address,
            p_city: cityVal,
            p_state: state,
            p_country: country,
            p_lat: lat,
            p_lng: lng,
            p_google_place_id: google_place_id,
            p_foursquare_id: null,
            p_cover_image_url: null,
          }
        )

        if (rpcError || !placeId) {
          // Fallback: plain upsert on (app_id, google_place_id)
          const { error: upsertError } = await supabase
            .from("places")
            .upsert(
              { app_id, name, address, city: cityVal, state, country, lat, lng, google_place_id },
              { onConflict: "app_id,google_place_id" }
            )

          if (upsertError) {
            console.warn(`  ⚠️  Could not upsert "${name}": ${upsertError.message}`)
            skipped++
          } else {
            console.log(`  ✅  ${app_id} / ${name} (${cityVal})`)
            inserted++
          }
        } else {
          console.log(`  ✅  ${app_id} / ${name} (${cityVal})`)
          inserted++
        }
      }

      // Nominatim's usage policy: max 1 request/second
      await sleep(DELAY_MS)
    }
  }

  console.log(`\n🎉  Done — ${inserted} places upserted, ${skipped} skipped.`)
}

main().catch(err => {
  console.error("Fatal:", err)
  process.exit(1)
})
