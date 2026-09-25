// ─── Place catalog: seed real cafés by area, classify them, list them ────────
// Server-side counterpart to nearby.ts. The first visit to a ~2 km grid cell
// imports that area's cafés (or bubble tea shops) from OpenStreetMap through
// import_osm_places (migration 012); after that, places_near() answers from
// our own database, reviewed or not. Rule-based classification happens here;
// scripts/classify-places.mjs can later refine it with a model.

import type { AppId } from "@niche/shared-types"
import { BOBA_NAMES, overpassQuery, type LatLng, type NearbyKind } from "./nearby"

type SupabaseClient = any // eslint-disable-line @typescript-eslint/no-explicit-any

export type PlaceKind = "specialty" | "chain" | "casual" | "other"

export interface OsmElement {
  type: string
  id: number
  lat?: number
  lon?: number
  center?: { lat: number; lon: number }
  tags?: Record<string, string>
}

export interface Classification { relevant: boolean; kind: PlaceKind; descriptors: string[] }

export interface CatalogPlace {
  id: string
  name: string
  address: string
  city: string
  lat: number
  lng: number
  google_place_id: string | null
  cover_image_url: string | null
  avg_score: number | null
  review_count: number
  kind: PlaceKind | null
  descriptors: string[]
  distance_m: number
}

const COFFEE_CHAINS = /^(starbucks|peet'?s|dunkin|tim hortons|costa|caribou|dutch bros|the coffee bean|coffee bean & tea leaf|pret|mcdonald'?s|mccaf[eé]|panera|biggby|scooter'?s|second cup|gloria jean'?s|krispy kreme|philz|blue bottle|la colombe|joe & the juice|black rifle|7 brew|human bean|ziggi'?s|paris baguette|85°c|tous les jours)/i
const BOBA_CHAINS = /^(gong ?cha|chatime|kung ?fu tea|sharetea|coco|tiger ?sugar|7 ?leaves|happy ?lemon|boba guys|yi ?fang|the alley|heytea|chagee|xing ?fu tang|presotea|machi machi|tp ?tea|wushiland|ten ren|quickly|lollicup|boba time|it'?s boba time|sunright|teaspoon|feng cha|molly ?tea|kung fu tea)/i
const SPECIALTY_HINTS = /roast|espresso|brew bar|coffee bar|coffee co|coffee lab|coffee works|single origin|pour ?over/i
const BOBA_PATTERN = new RegExp(BOBA_NAMES, "i")

/** Rules over OSM tags. Conservative: when unsure, keep the place and call it casual. */
export function classifyOsmPlace(niche: NearbyKind, tags: Record<string, string> = {}): Classification {
  const name = tags.name ?? ""
  const cuisine = (tags.cuisine ?? "").toLowerCase()
  const branded = !!(tags.brand || tags["brand:wikidata"])
  const isBoba = cuisine.includes("bubble_tea") || BOBA_PATTERN.test(name)

  const descriptors: string[] = []
  if (tags.internet_access === "wlan" || tags.internet_access === "yes") descriptors.push("wifi")
  if (tags.outdoor_seating === "yes") descriptors.push("outdoor seating")
  if (tags.takeaway === "only") descriptors.push("to-go only")
  if (tags.drive_through === "yes") descriptors.push("drive-through")
  if (tags["diet:vegan"] === "yes" || tags["diet:vegan"] === "only") descriptors.push("vegan options")
  if (tags.craft === "roaster" || /roast/i.test(name)) descriptors.push("roaster")

  if (niche === "boba") {
    const relevant = isBoba
    const kind: PlaceKind = !relevant ? "other" : branded || BOBA_CHAINS.test(name) ? "chain" : "casual"
    return { relevant, kind, descriptors }
  }

  // Coffee: bubble tea shops, ice cream parlours and cake shops tagged "cafe" aren't coffee places.
  const notCoffee = isBoba || /ice_cream|frozen_yogurt|bubble_tea|juice/.test(cuisine) || tags.shop === "bakery"
  if (notCoffee) return { relevant: false, kind: "other", descriptors }
  if (branded || COFFEE_CHAINS.test(name)) return { relevant: true, kind: "chain", descriptors }
  if (SPECIALTY_HINTS.test(name) || cuisine.includes("coffee_shop") || tags.craft === "roaster") {
    return { relevant: true, kind: "specialty", descriptors }
  }
  return { relevant: true, kind: "casual", descriptors }
}

/** ~2.2 km cells: the unit an area is seeded in. */
export function cellFor({ lat, lng }: LatLng) {
  return `${Math.floor(lat / 0.02)}:${Math.floor(lng / 0.02)}`
}

const DEFAULT_OVERPASS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
]

/** Server-side Overpass with a descriptive User-Agent, trying mirrors in turn. Null if all fail. */
export async function fetchOverpassElements(
  niche: NearbyKind,
  at: LatLng,
  radius: number,
  { endpoints = DEFAULT_OVERPASS, userAgent = "NicheApp/1.0 (+https://github.com/jonathanchin22/Niche)", timeoutMs = 12_000 }:
    { endpoints?: string[]; userAgent?: string; timeoutMs?: number } = {}
): Promise<OsmElement[] | null> {
  const query = overpassQuery(niche, at, radius)
  for (const url of endpoints) {
    try {
      const res = await fetch(`${url}?${new URLSearchParams({ data: query })}`, {
        headers: { "User-Agent": userAgent, Accept: "application/json" },
        signal: AbortSignal.timeout(timeoutMs),
      })
      if (!res.ok) continue
      const json = await res.json()
      return Array.isArray(json.elements) ? json.elements : []
    } catch {
      // try the next mirror
    }
  }
  return null
}

function toImportRow(niche: NearbyKind, el: OsmElement) {
  const t = el.tags ?? {}
  const lat = el.lat ?? el.center?.lat
  const lng = el.lon ?? el.center?.lon
  if (!t.name || lat == null || lng == null) return null
  const c = classifyOsmPlace(niche, t)
  // Keep only the tags worth showing or re-classifying from.
  const keep = ["amenity", "cuisine", "brand", "shop", "craft", "website", "opening_hours", "internet_access",
    "outdoor_seating", "takeaway", "drive_through", "diet:vegan", "addr:street", "addr:housenumber", "addr:city"]
  return {
    osm_id: `osm_${el.type}_${el.id}`,
    name: t.name,
    address: [t["addr:housenumber"], t["addr:street"]].filter(Boolean).join(" "),
    city: t["addr:city"] ?? "",
    state: t["addr:state"] ?? "",
    lat, lng,
    kind: c.kind,
    relevant: c.relevant,
    descriptors: c.descriptors,
    tags: Object.fromEntries(Object.entries(t).filter(([k]) => keep.includes(k))),
  }
}

const RESEED_AFTER_MS = 30 * 24 * 60 * 60 * 1000

/**
 * Relevant places near a point, nearest first — reviewed or not. Seeds the
 * surrounding cell from OpenStreetMap on first visit (or monthly). Seeding is
 * best-effort: if Overpass is down, it lists what the database already has.
 */
export async function getNearbyCatalog(
  supabase: SupabaseClient,
  { app_id, niche, at, radius = 2500, limit = 60, overpassEndpoints }:
    { app_id: AppId; niche: NearbyKind; at: LatLng; radius?: number; limit?: number; overpassEndpoints?: string[] }
): Promise<{ places: CatalogPlace[]; seeded: boolean }> {
  const cell = cellFor(at)
  const { data: area } = await supabase
    .from("seeded_areas")
    .select("seeded_at")
    .eq("app_id", app_id)
    .eq("cell", cell)
    .maybeSingle()

  let seeded = false
  if (!area || Date.now() - new Date(area.seeded_at).getTime() > RESEED_AFTER_MS) {
    const elements = await fetchOverpassElements(niche, at, niche === "cafe" ? 1_500 : 3_000, { endpoints: overpassEndpoints })
    if (elements) {
      const seen = new Set<string>()
      const rows = elements
        .map(el => toImportRow(niche, el))
        .filter((r): r is NonNullable<ReturnType<typeof toImportRow>> => !!r && !seen.has(r.osm_id) && !!seen.add(r.osm_id))
      for (let i = 0; i === 0 || i < rows.length; i += 150) {
        const { error } = await supabase.rpc("import_osm_places", { p_app_id: app_id, p_cell: cell, p_places: rows.slice(i, i + 150) })
        if (error) break
      }
      seeded = true
    }
  }

  const { data, error } = await supabase.rpc("places_near", {
    p_app_id: app_id, p_lat: at.lat, p_lng: at.lng, p_radius_m: radius, p_limit: limit,
  })
  if (error) throw error
  return {
    seeded,
    places: (data ?? []).map((p: any) => ({
      ...p,
      avg_score: p.avg_score == null ? null : Number(p.avg_score),
      review_count: Number(p.review_count ?? 0),
      descriptors: p.descriptors ?? [],
    })),
  }
}

/**
 * Turn a map search result (not yet in our database) into a place, so it gets
 * a real page. Doesn't mark the area as seeded. Returns the place id.
 */
export async function importFoundPlace(
  supabase: SupabaseClient,
  { app_id, place }: { app_id: AppId; place: { google_place_id: string; name: string; address?: string; city?: string; state?: string; lat: number; lng: number } }
): Promise<string | null> {
  const { error } = await supabase.rpc("import_osm_places", {
    p_app_id: app_id,
    p_cell: null,
    p_places: [{ osm_id: place.google_place_id, name: place.name, address: place.address ?? "", city: place.city ?? "", state: place.state ?? "", lat: place.lat, lng: place.lng }],
  })
  if (error) throw error
  const { data } = await supabase
    .from("places")
    .select("id")
    .eq("app_id", app_id)
    .eq("google_place_id", place.google_place_id)
    .maybeSingle()
  return data?.id ?? null
}

/** Who logged a place first (for the "first logged by" line). */
export async function getFirstLog(
  supabase: SupabaseClient,
  place_id: string
): Promise<{ username: string; created_at: string } | null> {
  const { data } = await supabase
    .from("reviews")
    .select("created_at, user:profiles!reviews_user_id_fkey(username)")
    .eq("place_id", place_id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()
  return data?.user?.username ? { username: data.user.username, created_at: data.created_at } : null
}
