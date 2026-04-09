"use client"

import { useState, useEffect, useTransition, useCallback, useRef } from "react"
import { createBrowserClient } from "@supabase/ssr"
import { searchPlaces, getMapPins } from "@niche/database"
import { MonoLabel, Stars, AeroSketch } from "@/components/ui/Primitives"
import type { Place } from "@niche/shared-types"
import Link from "next/link"
import { useRouter } from "next/navigation"
import dynamic from "next/dynamic"
import type { PlacePin } from "@/components/ui/NearbyMap"

// Load the map only in the browser (maplibre-gl is not SSR-compatible)
const NearbyMap = dynamic(() => import("@/components/ui/NearbyMap"), { ssr: false })

const APP_ID = "brew" as const

const CATS = [
  { label: "staff picks", query: "" },
  { label: "pour over",   query: "pour over" },
  { label: "espresso",    query: "espresso" },
  { label: "cold brew",   query: "cold brew" },
  { label: "matcha",      query: "matcha" },
  { label: "seasonal",    query: "seasonal" },
] as const

function getSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export default function ExploreClient({ userId }: { userId: string }) {
  const router = useRouter()
  const [catIdx, setCatIdx] = useState(0)
  const [places, setPlaces] = useState<Place[]>([])
  const [isPending, startTransition] = useTransition()
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<Place[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [viewMode, setViewMode] = useState<"list" | "map">("list")
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [locationError, setLocationError] = useState<string | null>(null)
  const [isLocating, setIsLocating] = useState(false)
  const [nearbyPins, setNearbyPins] = useState<PlacePin[]>([])
  const searchTimeout = useRef<ReturnType<typeof setTimeout>>()

  const cat = CATS[catIdx] || CATS[0]

  useEffect(() => {
    startTransition(async () => {
      const results = await searchPlaces(getSupabase(), {
        app_id: APP_ID,
        query: cat.query,
      })
      setPlaces(results)
    })
  }, [catIdx])

  const handleSearch = useCallback((q: string) => {
    setSearchQuery(q)
    clearTimeout(searchTimeout.current)
    if (q.length < 2) { setSearchResults([]); return }
    setIsSearching(true)
    searchTimeout.current = setTimeout(async () => {
      const results = await searchPlaces(getSupabase(), {
        app_id: APP_ID,
        query: q,
      })
      setSearchResults(results)
      setIsSearching(false)
    }, 400)
  }, [])

  const handleNearMe = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationError("Geolocation is not supported by your browser.")
      return
    }
    setIsLocating(true)
    setLocationError(null)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords
        setUserLocation({ lat: latitude, lng: longitude })
        const delta = 0.05 // ~5.5 km bounding box
        try {
          const supabase = getSupabase()
          const pins = await getMapPins(supabase, {
            app_id: APP_ID,
            user_id: userId,
            bounds: {
              north: latitude + delta,
              south: latitude - delta,
              east: longitude + delta,
              west: longitude - delta,
            },
          })
          setNearbyPins(
            pins.map((p: any) => ({
              id: p.place_id ?? p.id ?? "",
              name: p.name ?? "",
              latitude: p.latitude ?? p.lat ?? 0,
              longitude: p.longitude ?? p.lng ?? 0,
              avg_score: p.avg_score ?? null,
              review_count: p.review_count ?? 0,
            }))
          )
        } catch {
          // If getMapPins fails, at least show user location on map
        }
        setIsLocating(false)
        setViewMode("map")
      },
      (err) => {
        setIsLocating(false)
        setLocationError(
          err.code === 1
            ? "Location access denied. Please allow location in your browser settings."
            : "Could not get your location. Please try again."
        )
      },
      { timeout: 10000, maximumAge: 60000 }
    )
  }, [userId])

  // Filter out 'brewed at home' (homebrew) places
  const filterHomebrew = (arr: Place[]) => arr.filter(
    p =>
      p.name !== "Brewed at home" &&
      p.city !== "home" &&
      p.google_place_id !== "brew_home"
  )
  const displayPlaces = searchQuery.length > 1 ? filterHomebrew(searchResults) : filterHomebrew(places)
  const displayPending = searchQuery.length > 1 ? isSearching : isPending

  useEffect(() => {
    if (displayPending) return
    displayPlaces.slice(0, 8).forEach(place => {
      router.prefetch(`/place/${place.id}`)
    })
  }, [displayPending, displayPlaces, router])

  return (
    <div style={{ display: "flex", height: "calc(100svh - 88px)", paddingTop: 52, overflow: "hidden" }}>

      {/* Side rail */}
      <div style={{
        width: 96, flexShrink: 0, borderRight: "1px solid var(--c-rule)",
        background: "var(--c-bg)", overflowY: "auto", paddingTop: 20,
      }}>
        {CATS.map((c, i) => (
          <button key={c.label} type="button" onClick={() => { setCatIdx(i); setViewMode("list") }} style={{
            display: "block", width: "100%", background: "none", border: "none",
            borderBottom: "1px solid var(--c-rule)", padding: "14px 10px",
            textAlign: "left", cursor: "pointer",
            borderLeft: i === catIdx ? "3px solid var(--c-accent)" : "3px solid transparent",
          }}>
            <span style={{
              fontFamily: "var(--font-mono)", fontSize: 9, lineHeight: 1.5,
              color: i === catIdx ? "var(--c-accent)" : "var(--c-subtle)",
              letterSpacing: "0.08em", textTransform: "uppercase",
            }}>
              {c.label}
            </span>
          </button>
        ))}

        {/* Near me button */}
        <button
          type="button"
          onClick={handleNearMe}
          disabled={isLocating}
          style={{
            display: "block", width: "100%", background: "none", border: "none",
            borderBottom: "1px solid var(--c-rule)", padding: "14px 10px",
            textAlign: "left", cursor: isLocating ? "default" : "pointer",
            borderLeft: userLocation ? "3px solid var(--c-accent)" : "3px solid transparent",
            opacity: isLocating ? 0.6 : 1,
          }}
        >
          <span style={{
            fontFamily: "var(--font-mono)", fontSize: 9, lineHeight: 1.5,
            color: userLocation ? "var(--c-accent)" : "var(--c-subtle)",
            letterSpacing: "0.08em", textTransform: "uppercase",
          }}>
            {isLocating ? "..." : "near me"}
          </span>
        </button>

        {/* Map / List toggle */}
        <button
          type="button"
          onClick={() => setViewMode(v => v === "list" ? "map" : "list")}
          style={{
            display: "block", width: "100%", background: "none", border: "none",
            borderBottom: "1px solid var(--c-rule)", padding: "14px 10px",
            textAlign: "left", cursor: "pointer",
            borderLeft: viewMode === "map" ? "3px solid var(--c-accent)" : "3px solid transparent",
          }}
        >
          <span style={{
            fontFamily: "var(--font-mono)", fontSize: 9, lineHeight: 1.5,
            color: viewMode === "map" ? "var(--c-accent)" : "var(--c-subtle)",
            letterSpacing: "0.08em", textTransform: "uppercase",
          }}>
            {viewMode === "map" ? "list" : "map"}
          </span>
        </button>
      </div>

      {/* Content panel */}
      <div style={{ flex: 1, overflowY: "auto", padding: "20px 0" }}>
        {/* Search bar */}
        <div style={{ padding: "0 20px 20px" }}>
          <div style={{
            display: "flex", alignItems: "center",
            border: "1px solid var(--c-rule)", borderRadius: 8,
            padding: "12px 16px", background: "var(--c-bg)", gap: 8,
          }}>
            <span style={{ color: "var(--c-subtle)", fontSize: 14 }}>◎</span>
            <input
              value={searchQuery}
              onChange={e => handleSearch(e.target.value)}
              placeholder="search places or drinks..."
              style={{
                flex: 1, border: "none", outline: "none", background: "transparent",
                fontFamily: "var(--font-display)", fontSize: 16, color: "var(--c-ink)",
                fontStyle: "italic",
              }}
            />
            {isSearching && <MonoLabel>...</MonoLabel>}
          </div>
        </div>

        {/* Location error */}
        {locationError && (
          <div style={{ padding: "0 20px 16px" }}>
            <p style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "#c0392b", margin: 0, letterSpacing: "0.05em" }}>
              {locationError}
            </p>
          </div>
        )}

        <div style={{ padding: "0 20px 12px" }}>
          <p style={{
            fontFamily: "var(--font-display)", fontSize: 24, color: "var(--c-ink)",
            margin: 0, fontWeight: 400, fontStyle: "italic",
          }}>
            {searchQuery.length > 1 ? `searching "${searchQuery}"` : viewMode === "map" ? "map view" : cat.label}
          </p>
        </div>

        {/* Map view */}
        {viewMode === "map" && (
          <div style={{ padding: "0 20px 20px" }}>
            <NearbyMap
              pins={
                nearbyPins.length > 0
                  ? nearbyPins
                  : displayPlaces
                      .filter(p => p.lat && p.lng)
                      .map(p => ({
                        id: p.id,
                        name: p.name,
                        latitude: p.lat,
                        longitude: p.lng,
                        avg_score: p.avg_score,
                        review_count: p.review_count,
                      }))
              }
              userLocation={userLocation}
              onPinClick={(id) => router.push(`/place/${id}`)}
              height={340}
              initialZoom={userLocation ? 14 : 12}
            />
            {!userLocation && (
              <button
                type="button"
                onClick={handleNearMe}
                disabled={isLocating}
                style={{
                  marginTop: 10, width: "100%", background: "none",
                  border: "1px solid var(--c-rule)", padding: "10px",
                  fontFamily: "var(--font-mono)", fontSize: 9, cursor: isLocating ? "default" : "pointer",
                  color: "var(--c-subtle)", letterSpacing: "0.1em", textTransform: "uppercase",
                  opacity: isLocating ? 0.6 : 1,
                }}
              >
                {isLocating ? "locating..." : "◉ center on my location"}
              </button>
            )}
          </div>
        )}

        {displayPending && viewMode === "list" && (
          <div style={{ padding: "24px 20px" }}>
            <MonoLabel>searching...</MonoLabel>
          </div>
        )}

        {!displayPending && viewMode === "list" && displayPlaces.length === 0 && (
          <div style={{ padding: "32px 20px", textAlign: "center" }}>
            <AeroSketch />
            <p style={{ fontFamily: "var(--font-hand)", fontSize: 15, color: "var(--c-subtle)", marginTop: 16 }}>
              {searchQuery.length > 1 ? `No results for "${searchQuery}"` : "No cafes logged here yet."}
            </p>
          </div>
        )}

        {!displayPending && viewMode === "list" && displayPlaces.map(place => (
          <Link
            key={place.id}
            href={`/place/${place.id}`}
            prefetch
            onMouseEnter={() => router.prefetch(`/place/${place.id}`)}
            onFocus={() => router.prefetch(`/place/${place.id}`)}
            style={{ textDecoration: "none" }}
          >
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--c-rule)", cursor: "pointer" }}>

              {/* Cover photo placeholder */}
              <div style={{
                height: 100, background: "var(--c-tint)", borderRadius: 4,
                marginBottom: 12, display: "flex", alignItems: "center", justifyContent: "center",
                overflow: "hidden",
              }}>
                {place.cover_image_url ? (
                  <img src={place.cover_image_url} alt={place.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <span style={{ fontFamily: "var(--font-hand)", fontSize: 13, color: "var(--c-subtle)" }}>
                    {place.name}
                  </span>
                )}
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
                <p style={{
                  fontFamily: "var(--font-display)", fontSize: 18, color: "var(--c-ink)",
                  margin: 0, fontWeight: 400,
                }}>
                  {place.name}
                </p>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  {place.avg_score != null && (
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--c-gold)", letterSpacing: "-0.02em" }}>
                      {place.avg_score.toFixed(1)}
                    </span>
                  )}
                  <Stars value={place.avg_score != null ? (place.avg_score / 10) * 5 : 0} />
                </div>
              </div>

              {place.city && (
                <MonoLabel style={{ marginBottom: 8 }}>{place.city}{place.state ? `, ${place.state}` : ""}</MonoLabel>
              )}

              <MonoLabel>{place.review_count} logged</MonoLabel>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
