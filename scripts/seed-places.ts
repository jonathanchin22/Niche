#!/usr/bin/env tsx
/**
 * Seed Supabase with cafes and boba tea shops from Nominatim (OpenStreetMap).
 *
 * Usage:
 *   npx tsx scripts/seed-places.ts [--city "San Francisco, CA"] [--type all|brew|boba]
 *
 * Environment variables (in .env or shell):
 *   SUPABASE_URL            — your Supabase project URL
 *   SUPABASE_SERVICE_KEY    — service role key (bypasses RLS) — preferred
 *   SUPABASE_ANON_KEY       — anon key (falls back if no service key)
 *
 * The script respects Nominatim's usage policy (1 req/s, User-Agent header).
 */

import { createClient } from "@supabase/supabase-js"

// ─── Config ──────────────────────────────────────────────────────────────────

const DEFAULT_CITIES = [
  "San Francisco, CA",
  "New York, NY",
  "Los Angeles, CA",
  "Chicago, IL",
  "Seattle, WA",
  "Austin, TX",
  "Boston, MA",
  "Portland, OR",
]

// Nominatim search queries per app
const QUERIES: Record<string, string[]> = {
  brew: ["coffee shop", "cafe", "specialty coffee", "espresso bar"],
  boba: ["bubble tea", "boba tea shop", "milk tea shop", "tea house"],
}

// ─── CLI args ────────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2)
  let city: string | null = null
  let type: "all" | "brew" | "boba" = "all"

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--city" && args[i + 1]) city = args[++i]
    if (args[i] === "--type" && args[i + 1]) type = args[++i] as "all" | "brew" | "boba"
  }

  return { city, type }
}

// ─── Nominatim helpers ───────────────────────────────────────────────────────

interface NominatimResult {
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
    country?: string
    country_code?: string
    postcode?: string
  }
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function nominatimSearch(query: string, city: string): Promise<NominatimResult[]> {
  const encoded = encodeURIComponent(`${query} in ${city}`)
  const url = `https://nominatim.openstreetmap.org/search?q=${encoded}&format=json&limit=15&addressdetails=1`

  const res = await fetch(url, {
    headers: {
      "User-Agent": "Niche-SeedScript/1.0 (github.com/jonathanchin22/Niche)",
      "Accept-Language": "en",
    },
  })

  if (!res.ok) {
    console.warn(`  Nominatim error ${res.status} for "${query} in ${city}"`)
    return []
  }

  return res.json()
}

function buildAddress(addr: NominatimResult["address"]): string {
  if (!addr) return ""
  const parts: string[] = []
  if (addr.house_number && addr.road) parts.push(`${addr.house_number} ${addr.road}`)
  else if (addr.road) parts.push(addr.road)
  return parts.join(", ")
}

function extractCity(addr: NominatimResult["address"]): string {
  return addr?.city ?? addr?.town ?? addr?.village ?? ""
}

// ─── Supabase upsert ─────────────────────────────────────────────────────────

interface PlaceRow {
  app_id: string
  name: string
  address: string
  city: string
  state: string
  country: string
  lat: number
  lng: number
  google_place_id: string
  foursquare_id: null
  cover_image_url: null
}

async function upsertPlaces(supabase: ReturnType<typeof createClient>, places: PlaceRow[]) {
  if (places.length === 0) return 0

  const { error, count } = await supabase
    .from("places")
    .upsert(places, { onConflict: "app_id,google_place_id", ignoreDuplicates: true })
    .select("id", { count: "exact", head: true })

  if (error) {
    console.error("  Supabase upsert error:", error.message)
    return 0
  }
  return count ?? places.length
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const { city, type } = parseArgs()

  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY ?? process.env.SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    console.error(
      "Error: SUPABASE_URL and SUPABASE_SERVICE_KEY (or SUPABASE_ANON_KEY) must be set."
    )
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  const cities = city ? [city] : DEFAULT_CITIES
  const appIds: Array<"brew" | "boba"> =
    type === "all" ? ["brew", "boba"] : [type as "brew" | "boba"]

  let totalInserted = 0

  for (const currentCity of cities) {
    console.log(`\n📍 ${currentCity}`)

    for (const appId of appIds) {
      const queries = QUERIES[appId]
      const places: PlaceRow[] = []
      const seenIds = new Set<string>()

      for (const q of queries) {
        console.log(`  🔍 searching "${q}"...`)
        const results = await nominatimSearch(q, currentCity)

        for (const r of results) {
          const placeId = `nominatim_${r.osm_id}`
          if (seenIds.has(placeId)) continue
          seenIds.add(placeId)

          const name = r.name || r.display_name.split(",")[0]
          if (!name || name.length < 2) continue

          places.push({
            app_id: appId,
            name,
            address: buildAddress(r.address),
            city: extractCity(r.address),
            state: r.address?.state ?? "",
            country: (r.address?.country_code ?? "us").toUpperCase(),
            lat: parseFloat(r.lat),
            lng: parseFloat(r.lon),
            google_place_id: placeId,
            foursquare_id: null,
            cover_image_url: null,
          })
        }

        // Nominatim rate limit: 1 request per second
        await sleep(1100)
      }

      if (places.length > 0) {
        const inserted = await upsertPlaces(supabase, places)
        console.log(`  ✅ ${appId}: upserted ${places.length} places (${inserted} new)`)
        totalInserted += places.length
      } else {
        console.log(`  ⚠️  ${appId}: no results found`)
      }
    }
  }

  console.log(`\n🎉 Done — ${totalInserted} total place rows processed.`)
}

main().catch(err => {
  console.error("Fatal error:", err)
  process.exit(1)
})
