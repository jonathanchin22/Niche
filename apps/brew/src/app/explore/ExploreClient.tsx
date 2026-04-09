"use client"

import { useState, useEffect, useTransition, useCallback, useRef } from "react"
import { createBrowserClient } from "@supabase/ssr"
import { getNearbyPlaces, searchPlaces } from "@niche/database"
import { MonoLabel, Stars, AeroSketch } from "@/components/ui/Primitives"
import type { Place } from "@niche/shared-types"
import Link from "next/link"
import { useRouter } from "next/navigation"

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
  const [nearbyPlaces, setNearbyPlaces] = useState<Array<Place & { distance_miles: number }>>([])
  const [isPending, startTransition] = useTransition()
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<Place[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [isLocating, setIsLocating] = useState(false)
  const [nearMeError, setNearMeError] = useState("")
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
    if (!("geolocation" in navigator)) {
      setNearMeError("location is not available in this browser")
      return
    }

    setNearMeError("")
    setIsLocating(true)

    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const results = await getNearbyPlaces(getSupabase(), {
            app_id: APP_ID,
            latitude: coords.latitude,
            longitude: coords.longitude,
            limit: 4,
          })
          setNearbyPlaces(filterHomebrew(results))
          if (results.length === 0) setNearMeError("no logged cafes nearby yet")
        } catch {
          setNearMeError("could not load nearby cafes")
        } finally {
          setIsLocating(false)
        }
      },
      () => {
        setNearMeError("location permission was denied")
        setIsLocating(false)
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
    )
  }, [])

  const formatDistance = (distance: number) => {
    if (distance < 1) return `${(distance * 5280).toFixed(0)} ft away`
    return `${distance.toFixed(1)} mi away`
  }

  // Filter out 'brewed at home' (homebrew) places while preserving the item type
  const filterHomebrew = <T extends Place>(arr: T[]) => arr.filter(
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
          <button key={c.label} type="button" onClick={() => setCatIdx(i)} style={{
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

        <div style={{ padding: "0 20px 12px" }}>
          <p style={{
            fontFamily: "var(--font-display)", fontSize: 24, color: "var(--c-ink)",
            margin: 0, fontWeight: 400, fontStyle: "italic",
          }}>
            {searchQuery.length > 1 ? `searching "${searchQuery}"` : cat.label}
          </p>
        </div>

        {!searchQuery && (
          <div style={{ padding: "0 20px 20px" }}>
            <div style={{ border: "1px solid var(--c-rule)", borderRadius: 8, padding: 16, background: "var(--c-bg)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: nearbyPlaces.length > 0 || nearMeError ? 12 : 0 }}>
                <div>
                  <p style={{ fontFamily: "var(--font-display)", fontSize: 22, color: "var(--c-ink)", margin: "0 0 4px", fontWeight: 400, fontStyle: "italic" }}>
                    near me
                  </p>
                  <MonoLabel>find logged cafes close to you</MonoLabel>
                </div>
                <button
                  type="button"
                  onClick={handleNearMe}
                  disabled={isLocating}
                  style={{
                    background: "var(--c-accent)", color: "white", border: "none", borderRadius: 999,
                    padding: "10px 14px", cursor: "pointer", fontFamily: "var(--font-mono)", fontSize: 10,
                    letterSpacing: "0.08em", textTransform: "uppercase", opacity: isLocating ? 0.7 : 1,
                  }}
                >
                  {isLocating ? "locating..." : nearbyPlaces.length > 0 ? "refresh" : "use my location"}
                </button>
              </div>

              {nearMeError && (
                <p style={{ fontFamily: "var(--font-hand)", fontSize: 14, color: "var(--c-subtle)", margin: nearbyPlaces.length > 0 ? "0 0 12px" : 0 }}>
                  {nearMeError}
                </p>
              )}

              {nearbyPlaces.length > 0 && (
                <div style={{ display: "grid", gap: 10 }}>
                  {nearbyPlaces.map(place => (
                    <Link
                      key={`nearby-${place.id}`}
                      href={`/place/${place.id}`}
                      prefetch
                      onMouseEnter={() => router.prefetch(`/place/${place.id}`)}
                      onFocus={() => router.prefetch(`/place/${place.id}`)}
                      style={{ textDecoration: "none" }}
                    >
                      <div style={{ border: "1px solid var(--c-rule)", borderRadius: 6, padding: "12px 14px", background: "var(--c-tint)" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                          <div>
                            <p style={{ fontFamily: "var(--font-display)", fontSize: 17, color: "var(--c-ink)", margin: "0 0 2px", fontWeight: 400 }}>
                              {place.name}
                            </p>
                            <MonoLabel>{place.city}{place.state ? `, ${place.state}` : ""}</MonoLabel>
                          </div>
                          <div style={{ textAlign: "right" }}>
                            <MonoLabel style={{ color: "var(--c-accent)" }}>{formatDistance(place.distance_miles)}</MonoLabel>
                            <MonoLabel>{place.review_count} logged</MonoLabel>
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {displayPending && (
          <div style={{ padding: "24px 20px" }}>
            <MonoLabel>searching...</MonoLabel>
          </div>
        )}

        {!displayPending && displayPlaces.length === 0 && (
          <div style={{ padding: "32px 20px", textAlign: "center" }}>
            <AeroSketch />
            <p style={{ fontFamily: "var(--font-hand)", fontSize: 15, color: "var(--c-subtle)", marginTop: 16 }}>
              {searchQuery.length > 1 ? `No results for "${searchQuery}"` : "No cafes logged here yet."}
            </p>
          </div>
        )}

        {!displayPending && displayPlaces.map(place => (
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
