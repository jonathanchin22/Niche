import type { CatalogPlace, LatLng } from "@niche/database"
import type { MapCamera } from "@/components/map/CafeMap"

/**
 * What "near you" looked like, kept for the tab session so tapping into a shop
 * and back returns to the same list or map (same tab, pin and camera) without
 * locating you and loading everything again.
 */
export interface SearchArea { lat: number; lng: number; radius: number }

export interface NearState {
  savedAt: number
  here: LatLng | null
  /** Set after "search this area": the centre and radius the places came from. */
  area: SearchArea | null
  places: CatalogPlace[]
  view: "list" | "map"
  tab: "near" | "first"
  camera: MapCamera | null
  selectedId: string | null
}

const KEY = "boba:explore-near"
const FRESH_MS = 15 * 60 * 1000

export function readNearState(): NearState | null {
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return null
    const state = JSON.parse(raw) as NearState
    return Date.now() - state.savedAt < FRESH_MS ? state : null
  } catch {
    return null
  }
}

export function writeNearState(patch: Partial<NearState>) {
  try {
    const prev = readNearState()
    const next: NearState = {
      here: null, area: null, places: [], view: "list", tab: "near", camera: null, selectedId: null,
      ...prev,
      ...patch,
      // Only a fresh location and place list restart the clock.
      savedAt: patch.places ? Date.now() : prev?.savedAt ?? Date.now(),
    }
    sessionStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    // Private mode or storage full: coming back just reloads.
  }
}
