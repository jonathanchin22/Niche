// ─── Nearby cafés & shops from OpenStreetMap ─────────────────────────────────
// Free and keyless. Overpass answers "what's around me"; Nominatim answers
// "find this name". Both return OSM ids, which we store as google_place_id
// ("osm_node_123") so the same café logged twice maps to one place row.

export type NearbyKind = "cafe" | "boba"

export interface FoundPlace {
  name: string
  address: string
  city: string
  state: string
  lat: number
  lng: number
  google_place_id: string
  /** Metres from the search point, when there was one. */
  distance?: number
}

export interface LatLng {
  lat: number
  lng: number
  /** Metres, 68% confidence, when it came from the device. */
  accuracy?: number
}

const OVERPASS = "https://overpass-api.de/api/interpreter"

// Chains and words that mark a bubble tea shop mapped as a plain café or takeaway.
const BOBA_NAMES = "boba|bubble|milk ?tea|tea ?house|chatime|gong ?cha|kung ?fu tea|tiger ?sugar|sharetea|coco|yi ?fang|7 ?leaves|machi|presotea|happy ?lemon|tp ?tea|xing ?fu|auntea|sunright|teazzi|teaspoon|wushiland|the alley|heytea|chagee|molly ?tea"

function overpassQuery(kind: NearbyKind, { lat, lng }: LatLng, radius: number) {
  const around = `(around:${radius},${lat},${lng})`
  const body = kind === "cafe"
    ? `nwr["amenity"="cafe"]${around};`
    : `nwr["cuisine"~"bubble_tea",i]${around};
       nwr["shop"="tea"]${around};
       nwr["amenity"~"^(cafe|fast_food|restaurant)$"]["name"~"${BOBA_NAMES}",i]${around};`
  return `[out:json][timeout:12];(${body});out tags center 80;`
}

/** Great-circle distance in metres. */
export function distanceMetres(a: LatLng, b: LatLng) {
  const rad = Math.PI / 180
  const dLat = (b.lat - a.lat) * rad
  const dLng = (b.lng - a.lng) * rad
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h))
}

export function formatDistance(metres?: number) {
  if (metres == null) return ""
  if (metres < 950) return `${Math.max(50, Math.round(metres / 50) * 50)} m`
  return `${(metres / 1000).toFixed(metres < 9_950 ? 1 : 0)} km`
}

function readCache<T>(key: string, maxAgeMs: number): T | null {
  try {
    const raw = sessionStorage.getItem(key)
    if (!raw) return null
    const { at, value } = JSON.parse(raw)
    return Date.now() - at < maxAgeMs ? value : null
  } catch { return null }
}

function writeCache(key: string, value: unknown) {
  try { sessionStorage.setItem(key, JSON.stringify({ at: Date.now(), value })) } catch {}
}

async function runOverpass(query: string, signal?: AbortSignal): Promise<any[]> {
  try {
    const res = await fetch(`${OVERPASS}?${new URLSearchParams({ data: query })}`, { signal })
    if (!res.ok) return []
    const json = await res.json()
    return json.elements ?? []
  } catch (e) {
    if (signal?.aborted) throw e
    return []
  }
}

/**
 * Cafés (or bubble tea shops) around a point, nearest first. Widens the search
 * once when the first radius finds almost nothing. Cached for the session, so
 * reopening the log screen nearby is instant.
 */
export async function findNearbyPlaces(
  kind: NearbyKind,
  at: LatLng,
  { limit = 12, signal }: { limit?: number; signal?: AbortSignal } = {}
): Promise<FoundPlace[]> {
  const key = `niche:nearby:${kind}:${at.lat.toFixed(3)},${at.lng.toFixed(3)}`
  const cached = readCache<FoundPlace[]>(key, 30 * 60_000)
  // The cache is keyed to a ~100 m grid, so re-measure from where they are now.
  if (cached) {
    return cached
      .map(p => ({ ...p, distance: distanceMetres(at, p) }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, limit)
  }

  const radii = kind === "cafe" ? [1_200, 4_000] : [3_000, 10_000]
  let places: FoundPlace[] = []
  for (const radius of radii) {
    const elements = await runOverpass(overpassQuery(kind, at, radius), signal)
    const seen = new Set<string>()
    places = elements
      .map((el): FoundPlace | null => {
        const t = el.tags ?? {}
        const lat = el.lat ?? el.center?.lat
        const lng = el.lon ?? el.center?.lon
        if (!t.name || lat == null || lng == null) return null
        return {
          name: t.name,
          address: [t["addr:housenumber"], t["addr:street"]].filter(Boolean).join(" "),
          city: t["addr:city"] ?? "",
          state: t["addr:state"] ?? "",
          lat, lng,
          google_place_id: `osm_${el.type}_${el.id}`,
          distance: distanceMetres(at, { lat, lng }),
        }
      })
      .filter((p): p is FoundPlace => !!p && !seen.has(p.google_place_id) && !!seen.add(p.google_place_id))
      .sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0))
    if (places.length >= 4) break
  }

  // Overpass is a shared public server and sometimes busy; Nominatim's
  // category search is a coarser but dependable fallback.
  if (places.length === 0) {
    const found: FoundPlace[] = []
    for (const q of kind === "cafe" ? ["cafe"] : ["boba", "tea"]) {
      found.push(...await searchPlacesByName(q, at, { limit: 30, signal, bounded: true }).catch(() => []))
    }
    const seen = new Set<string>()
    places = found
      .filter(p => !seen.has(p.google_place_id) && !!seen.add(p.google_place_id))
      .sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0))
  }

  const top = places.slice(0, 30)
  if (top.length) writeCache(key, top)
  return top.slice(0, limit)
}

/** Places matching a typed name, biased towards (not limited to) the user's area. */
export async function searchPlacesByName(
  query: string,
  near?: LatLng | null,
  { limit = 6, signal, bounded = false }: { limit?: number; signal?: AbortSignal; bounded?: boolean } = {}
): Promise<FoundPlace[]> {
  const params = new URLSearchParams({
    q: query, format: "jsonv2", addressdetails: "1", limit: String(limit), layer: "poi",
  })
  if (near) {
    const d = bounded ? 0.03 : 0.25 // ~3 km box to stay within, or ~25 km to prefer
    params.set("viewbox", [near.lng - d, near.lat + d, near.lng + d, near.lat - d].join(","))
    if (bounded) params.set("bounded", "1")
  }
  const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, { signal })
  if (!res.ok) return []
  const data: any[] = await res.json()
  return data.map(p => {
    const lat = parseFloat(p.lat)
    const lng = parseFloat(p.lon)
    const a = p.address ?? {}
    return {
      name: p.name || String(p.display_name).split(",")[0],
      address: [a.house_number, a.road].filter(Boolean).join(" ") || String(p.display_name).split(",").slice(1, 3).join(",").trim(),
      city: a.city || a.town || a.village || a.suburb || "",
      state: a.state || "",
      lat, lng,
      google_place_id: `osm_${p.osm_type ?? "node"}_${p.osm_id}`,
      distance: near ? distanceMetres(near, { lat, lng }) : undefined,
    }
  })
}

/** The browser's position, if the user allows it. Resolves null rather than throwing. */
export function getCurrentPosition(): Promise<LatLng | null> {
  return new Promise(resolve => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return resolve(null)
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
      () => resolve(null),
      // A fresh, precise fix: "you're at <café>" depends on it.
      { enableHighAccuracy: true, maximumAge: 60_000, timeout: 10_000 }
    )
  })
}

/**
 * The café the person is standing in, if it's clear-cut: the nearest one is
 * within 40 m, the location fix is good, and no other café is close behind
 * (so a busy block doesn't guess wrong). Otherwise null — show the list.
 */
export function detectCurrentPlace(nearby: FoundPlace[], here: LatLng): FoundPlace | null {
  const [first, second] = [...nearby]
    .filter(p => p.distance != null)
    .sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0))
  if (!first || first.distance == null) return null
  if (here.accuracy != null && here.accuracy > 60) return null
  if (first.distance > 40) return null
  if (second?.distance != null && second.distance - first.distance < 15) return null
  return first
}
