"use client"

import { useState, useCallback, useRef } from "react"
import { createBrowserClient } from "@supabase/ssr"
import { AppShell } from "@/components/ui/AppShell"
import Link from "next/link"
import { getNearbyPlaces, searchExternalPlaces } from "@niche/database"

const FILTERS = ["all", "nearby", "top rated", "new"]

async function searchPlaces(query: string) {
  if (!query || query.length < 2) return []
  const results = await searchExternalPlaces(query, "boba")
  return results.map(r => ({
    id: r.foursquare_id ?? `manual_${r.name.toLowerCase().replace(/\s+/g, "_")}`,
    name: r.name,
    neighborhood: r.city,
    address: r.address,
    tags: [] as string[],
    avg_score: null as number | null,
    review_count: 0,
  }))
}

function getSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

function formatDistance(distance: number) {
  if (distance < 1) return `${(distance * 5280).toFixed(0)} ft away`
  return `${distance.toFixed(1)} mi away`
}

function EmptySketch() {
  return (
    <svg width="160" height="130" viewBox="0 0 160 130" fill="none">
      <circle cx="80" cy="50" r="12" stroke="#1a1a1a" strokeWidth="1.5" fill="none"/>
      <line x1="80" y1="62" x2="80" y2="90" stroke="#1a1a1a" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M65 72 L80 68 L95 72" stroke="#1a1a1a" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
      <path d="M80 90 L73 108" stroke="#1a1a1a" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M80 90 L87 108" stroke="#1a1a1a" strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx="103" cy="72" r="9" stroke="#1a1a1a" strokeWidth="1.5" fill="none"/>
      <line x1="109" y1="79" x2="118" y2="88" stroke="#1a1a1a" strokeWidth="2" strokeLinecap="round"/>
      <text x="30" y="40" fontFamily="Georgia, serif" fontSize="14" fill="#ddd">?</text>
      <text x="120" y="35" fontFamily="Georgia, serif" fontSize="10" fill="#ddd">?</text>
    </svg>
  )
}

function ExploreSketch() {
  return (
    <svg width="180" height="130" viewBox="0 0 180 130" fill="none">
      <rect x="10" y="60" width="25" height="60" stroke="#2d6a4f" strokeWidth="1.5" fill="none"/>
      <rect x="40" y="40" width="30" height="80" stroke="#2d6a4f" strokeWidth="1.5" fill="none"/>
      <rect x="140" y="50" width="30" height="70" stroke="#2d6a4f" strokeWidth="1.5" fill="none"/>
      <rect x="15" y="70" width="6" height="6" stroke="#2d6a4f" strokeWidth="1" fill="none"/>
      <rect x="47" y="55" width="6" height="6" stroke="#2d6a4f" strokeWidth="1" fill="none"/>
      <rect x="60" y="55" width="6" height="6" stroke="#2d6a4f" strokeWidth="1" fill="none"/>
      <rect x="147" y="65" width="6" height="6" stroke="#2d6a4f" strokeWidth="1" fill="none"/>
      <circle cx="100" cy="70" r="8" stroke="#1a1a1a" strokeWidth="1.5" fill="none"/>
      <line x1="100" y1="78" x2="100" y2="105" stroke="#1a1a1a" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M88 88 L100 82 L112 88" stroke="#1a1a1a" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
      <path d="M100 105 L93 120" stroke="#1a1a1a" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M100 105 L107 120" stroke="#1a1a1a" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M112 88 L122 92" stroke="#1a1a1a" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M119 85 L124 97 L116 97 Z" stroke="#1a1a1a" strokeWidth="1.2" fill="none" strokeLinecap="round"/>
    </svg>
  )
}

export default function ExplorePage() {
  const [activeFilter, setActiveFilter] = useState("all")
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<any[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [nearbyResults, setNearbyResults] = useState<any[]>([])
  const [isLocating, setIsLocating] = useState(false)
  const [nearbyError, setNearbyError] = useState("")
  const searchTimeout = useRef<ReturnType<typeof setTimeout>>()

  const handleSearch = useCallback((q: string) => {
    setQuery(q)
    clearTimeout(searchTimeout.current)
    if (q.length < 2) { setResults([]); return }
    setIsSearching(true)
    searchTimeout.current = setTimeout(async () => {
      const data = await searchPlaces(q)
      setResults(data)
      setIsSearching(false)
    }, 400)
  }, [])

  const handleNearMe = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setNearbyError("location is not available in this browser")
      return
    }

    setNearbyError("")
    setIsLocating(true)

    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const places = await getNearbyPlaces(getSupabase(), {
            app_id: "boba",
            latitude: coords.latitude,
            longitude: coords.longitude,
            limit: 6,
          })
          setNearbyResults(places)
          setActiveFilter("nearby")
          if (places.length === 0) setNearbyError("no logged boba spots nearby yet")
        } catch {
          setNearbyError("could not load nearby spots")
        } finally {
          setIsLocating(false)
        }
      },
      () => {
        setNearbyError("location permission was denied")
        setIsLocating(false)
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
    )
  }, [])

  const showingNearby = !query && activeFilter === "nearby"
  const visibleResults = showingNearby ? nearbyResults : results

  return (
    <AppShell activeTab="explore">
      <div style={{ padding: "52px 0 20px" }}>

        {/* Header */}
        <div style={{ padding: "0 28px 20px" }}>
          <p style={{ fontFamily: "var(--font-hand)", fontSize: 15, color: "#888", margin: "0 0 4px" }}>
            boba spots worth knowing
          </p>
          <h1 style={{
            fontFamily: "'DM Serif Display', Georgia, serif",
            fontSize: 30, color: "#1a1a1a",
            margin: "0 0 20px", fontWeight: 400,
          }}>
            explore
          </h1>

          {/* Search */}
          <div style={{
            display: "flex", alignItems: "center",
            border: "1px solid #e8e8e4", borderRadius: 10,
            padding: "10px 14px", background: "white", gap: 8,
          }}>
            <span style={{ color: "#bbb", fontSize: 14 }}>◎</span>
            <input
              value={query}
              onChange={e => handleSearch(e.target.value)}
              placeholder="search shops or neighborhoods..."
              style={{
                flex: 1, border: "none", outline: "none", background: "transparent",
                fontFamily: "'DM Serif Display', Georgia, serif",
                fontSize: 16, color: "#1a1a1a",
              }}
            />
            {isSearching && <span style={{ fontFamily: "var(--font-hand)", fontSize: 13, color: "#bbb" }}>...</span>}
          </div>
        </div>

        {/* Filter chips */}
        <div style={{ display: "flex", gap: 8, padding: "0 28px 24px", overflowX: "auto" }}>
          {FILTERS.map(f => (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              style={{
                fontFamily: "'DM Sans', sans-serif", fontSize: 12,
                padding: "6px 16px", borderRadius: 20, whiteSpace: "nowrap",
                border: `1px solid ${activeFilter === f ? "#2d6a4f" : "#e8e8e4"}`,
                background: activeFilter === f ? "#e8f4ee" : "transparent",
                color: activeFilter === f ? "#2d6a4f" : "#888",
                cursor: "pointer",
              }}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Map placeholder / illustration */}
        {!query && (
          <div style={{
            margin: "0 28px 24px",
            height: 160,
            background: "#e8f4ee",
            borderRadius: 12,
            border: "1px solid #e8e8e4",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}>
            <ExploreSketch />
          </div>
        )}

        {!query && (
          <div style={{ margin: "0 28px 24px", padding: "18px", background: "white", border: "1px solid #e8e8e4", borderRadius: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 12 }}>
              <div>
                <p style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 22, margin: "0 0 4px", color: "#1a1a1a" }}>
                  near me
                </p>
                <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "#888", margin: 0 }}>
                  find logged boba spots around your current location
                </p>
              </div>
              <button
                type="button"
                onClick={handleNearMe}
                disabled={isLocating}
                style={{
                  background: "#2d6a4f", color: "#fff", border: "none", borderRadius: 999,
                  padding: "10px 14px", fontFamily: "'DM Sans', sans-serif", fontSize: 12,
                  cursor: "pointer", opacity: isLocating ? 0.7 : 1,
                }}
              >
                {isLocating ? "locating..." : nearbyResults.length > 0 ? "refresh" : "use my location"}
              </button>
            </div>

            {nearbyError && (
              <p style={{ fontFamily: "var(--font-hand)", fontSize: 14, color: "#888", margin: nearbyResults.length > 0 ? "0 0 12px" : 0 }}>
                {nearbyError}
              </p>
            )}

            {nearbyResults.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {nearbyResults.slice(0, 3).map((place) => (
                  <Link key={place.id} href={`/place/${place.id}`} style={{ textDecoration: "none" }}>
                    <div style={{ border: "1px solid #e8e8e4", borderRadius: 10, padding: "14px 16px", background: "#fafaf8" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
                        <div>
                          <p style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 16, margin: "0 0 2px", color: "#1a1a1a" }}>{place.name}</p>
                          <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "#888", margin: 0 }}>
                            {place.city}{place.state ? `, ${place.state}` : ""}
                          </p>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "#2d6a4f", margin: "0 0 2px" }}>{formatDistance(place.distance_miles)}</p>
                          <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: "#bbb", margin: 0 }}>{place.review_count} reviews</p>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Results */}
        <div style={{ padding: "0 28px", display: "flex", flexDirection: "column", gap: 12 }}>
          {visibleResults.length > 0 ? visibleResults.map((p) => (
            <Link key={p.id} href={`/place/${p.id}`} style={{ textDecoration: "none" }}>
              <div style={{
                background: "white", border: "1px solid #e8e8e4",
                borderRadius: 12, padding: "18px",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ flex: 1, marginRight: 12 }}>
                    <p style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 17, margin: "0 0 2px", color: "#1a1a1a" }}>
                      {p.name}
                    </p>
                    <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "#888", margin: "0 0 8px" }}>
                      {p.neighborhood ?? p.city ?? ""}
                    </p>
                    {(p.tags ?? []).length > 0 && (
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {(p.tags ?? []).map((t: string) => (
                          <span key={t} style={{
                            fontFamily: "'DM Sans', sans-serif", fontSize: 11,
                            background: "#e8f4ee", color: "#2d6a4f",
                            padding: "2px 8px", borderRadius: 10,
                          }}>{t}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  {p.avg_score != null && (
                    <div style={{ textAlign: "right" }}>
                      <p style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 18, margin: "0 0 2px", color: "#1a1a1a" }}>
                        {p.avg_score}
                      </p>
                      <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: "#bbb" }}>
                        {typeof p.distance_miles === "number" ? formatDistance(p.distance_miles) : `${p.review_count} reviews`}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </Link>
          )) : (
            <>
              {query.length > 1 && !isSearching && (
                <p style={{ fontFamily: "var(--font-hand)", fontSize: 16, color: "#bbb", textAlign: "center", padding: "20px 0" }}>
                  no results for "{query}"
                </p>
              )}
              {showingNearby && !isLocating && nearbyResults.length === 0 && nearbyError && (
                <p style={{ fontFamily: "var(--font-hand)", fontSize: 16, color: "#bbb", textAlign: "center", padding: "20px 0" }}>
                  {nearbyError}
                </p>
              )}

              {/* Empty state */}
              {!showingNearby && <div style={{
                padding: "40px 20px",
                display: "flex", flexDirection: "column", alignItems: "center", gap: 12,
                borderTop: "1px dashed #e8e8e4", marginTop: 8,
              }}>
                <EmptySketch />
                <span style={{ fontFamily: "'Courier New', monospace", fontSize: 10, color: "#bbb", letterSpacing: "0.05em", textTransform: "uppercase", border: "1px dashed #ddd", padding: "2px 10px", borderRadius: 2 }}>
                  know a spot that's missing?
                </span>
                <Link href="/log">
                  <button style={{
                    fontFamily: "'DM Sans', sans-serif", fontSize: 13,
                    background: "none", border: "1px solid #1a1a1a",
                    borderRadius: 6, padding: "8px 20px", cursor: "pointer",
                    color: "#1a1a1a",
                  }}>
                    log a drink there
                  </button>
                </Link>
              </div>}
            </>
          )}
        </div>
      </div>
    </AppShell>
  )
}
