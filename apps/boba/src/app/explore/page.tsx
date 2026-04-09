"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import dynamic from "next/dynamic"
import { AppShell } from "@/components/ui/AppShell"
import Link from "next/link"
import { createClient } from "@niche/auth/client"
import { getMapPins } from "@niche/database"

const BobaMap = dynamic(() => import("@/components/ui/BobaMap"), { ssr: false })

const FILTERS = ["all", "nearby", "top rated", "new"]

async function searchPlaces(query: string) {
  if (!query || query.length < 2) return []
  const encoded = encodeURIComponent(`${query} bubble tea boba`)
  const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encoded}&format=json&limit=6&addressdetails=1`)
  if (!res.ok) return []
  const data = await res.json()
  return data.map((p: any) => ({
    id: `nominatim_${p.osm_id}`,
    name: p.name || p.display_name.split(",")[0],
    neighborhood: p.address?.suburb || p.address?.city || p.address?.town || "",
    address: p.display_name,
    tags: [] as string[],
    avg_score: null as number | null,
    review_count: 0,
  }))
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

export default function ExplorePage() {
  const [activeFilter, setActiveFilter] = useState("all")
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<any[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const searchTimeout = useRef<ReturnType<typeof setTimeout>>()

  // Location + map state
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [locationDenied, setLocationDenied] = useState(false)
  const [locationRequested, setLocationRequested] = useState(false)
  const [mapPins, setMapPins] = useState<any[]>([])

  // Request location automatically on mount
  useEffect(() => {
    if (!navigator.geolocation) return
    setLocationRequested(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude })
      },
      () => {
        setLocationDenied(true)
      }
    )
  }, [])

  // Fetch DB pins when user location becomes known
  useEffect(() => {
    if (!userLocation) return
    const supabase = createClient()
    const delta = 0.08 // ~8 km radius
    getMapPins(supabase, {
      app_id: "boba",
      user_id: "",
      bounds: {
        north: userLocation.lat + delta,
        south: userLocation.lat - delta,
        east: userLocation.lng + delta,
        west: userLocation.lng - delta,
      },
    })
      .then((data: any[]) => setMapPins(data))
      .catch(() => {})
  }, [userLocation])

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

  const showMap = !query && (userLocation !== null || locationRequested)

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

        {/* Map — shown when no search query is active */}
        {showMap && (
          <div style={{ margin: "0 28px 24px" }}>
            <BobaMap
              userLocation={userLocation}
              pins={mapPins}
              height={220}
            />
            {!userLocation && !locationDenied && (
              <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "#aaa", textAlign: "center", marginTop: 8 }}>
                locating you...
              </p>
            )}
            {locationDenied && (
              <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "#aaa", textAlign: "center", marginTop: 8 }}>
                enable location to see nearby shops
              </p>
            )}
            {userLocation && mapPins.length === 0 && (
              <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "#aaa", textAlign: "center", marginTop: 8 }}>
                no logged shops nearby yet — be the first!
              </p>
            )}
            {userLocation && mapPins.length > 0 && (
              <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "#888", textAlign: "center", marginTop: 8 }}>
                {mapPins.length} boba {mapPins.length === 1 ? "shop" : "shops"} nearby
              </p>
            )}
          </div>
        )}

        {/* Results */}
        <div style={{ padding: "0 28px", display: "flex", flexDirection: "column", gap: 12 }}>
          {results.length > 0 ? results.map((p) => (
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
                      {p.neighborhood}
                    </p>
                    {p.tags.length > 0 && (
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {p.tags.map((t: string) => (
                          <span key={t} style={{
                            fontFamily: "'DM Sans', sans-serif", fontSize: 11,
                            background: "#e8f4ee", color: "#2d6a4f",
                            padding: "2px 8px", borderRadius: 10,
                          }}>{t}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  {p.avg_score && (
                    <div style={{ textAlign: "right" }}>
                      <p style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 18, margin: "0 0 2px", color: "#1a1a1a" }}>
                        {p.avg_score}
                      </p>
                      <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: "#bbb" }}>
                        {p.review_count} reviews
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

              {/* Empty state — only shown when map isn't visible */}
              {!showMap && (
                <div style={{
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
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </AppShell>
  )
}
