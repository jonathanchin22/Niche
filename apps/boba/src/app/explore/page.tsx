"use client"

import { useState, useCallback, useRef } from "react"
import { useQuery } from "@tanstack/react-query"
import { createClient } from "@niche/auth"
import { searchPlaces } from "@niche/database"
import { AppShell } from "@/components/ui/AppShell"
import Link from "next/link"

const VIBE_FILTERS = [
  { label: "All", value: "" },
  { label: "☕ Study spot", value: "good study spot" },
  { label: "🌙 Date night", value: "date night" },
  { label: "🎉 Groups", value: "large portions" },
  { label: "📸 Aesthetic", value: "instagrammable" },
  { label: "💰 Value", value: "great value" },
]

function PlaceCard({ place }: { place: any }) {
  const scoreColor = place.avg_score >= 8 ? "#059669" : place.avg_score >= 6 ? "#D97706" : "#9CA3AF"
  return (
    <Link href={`/place/${place.id}`}>
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-purple-50 active:scale-98 transition-transform">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-sm" style={{ color: "#12082A" }}>{place.name}</h3>
            <p className="text-xs mt-0.5 truncate" style={{ color: "#6B5B8A" }}>{place.address}</p>
            {place.review_count > 0 && (
              <p className="text-xs mt-1" style={{ color: "#B0A0CC" }}>
                {place.review_count} {place.review_count === 1 ? "review" : "reviews"}
              </p>
            )}
          </div>
          {place.avg_score > 0 && (
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-black text-sm flex-shrink-0" style={{ background: scoreColor }}>
              {place.avg_score?.toFixed(1)}
            </div>
          )}
        </div>
      </div>
    </Link>
  )
}

export default function ExplorePage() {
  const supabase = createClient()
  const [query, setQuery] = useState("")
  const [activeVibe, setActiveVibe] = useState("")
  const searchTimeout = useRef<ReturnType<typeof setTimeout>>()
  const [debouncedQuery, setDebouncedQuery] = useState("")

  const handleSearch = useCallback((q: string) => {
    setQuery(q)
    clearTimeout(searchTimeout.current)
    searchTimeout.current = setTimeout(() => setDebouncedQuery(q), 350)
  }, [])

  const { data: places, isLoading } = useQuery({
    queryKey: ["explore", "boba", debouncedQuery],
    queryFn: () => searchPlaces(supabase as any, { app_id: "boba", query: debouncedQuery || "a" }),
    staleTime: 30000,
  })

  const filtered = (places ?? []).filter((p: any) =>
    activeVibe ? p.tags?.includes(activeVibe) : true
  )

  return (
    <AppShell activeTab="explore">
      <div className="px-4 pt-4 pb-2">
        {/* Search bar */}
        <div className="relative mb-4">
          <svg className="absolute left-3 top-3" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            type="text"
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search boba spots..."
            className="w-full pl-10 pr-4 py-2.5 rounded-2xl border-2 text-sm font-medium outline-none transition-colors bg-white"
            style={{ borderColor: "#DDD6FE", color: "#12082A" }}
            onFocus={(e) => (e.target.style.borderColor = "#7C3AED")}
            onBlur={(e) => (e.target.style.borderColor = "#DDD6FE")}
          />
          {isLoading && (
            <div className="absolute right-3 top-3">
              <div className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "#7C3AED", borderTopColor: "transparent" }} />
            </div>
          )}
        </div>

        {/* Vibe filters */}
        <div className="flex gap-2 overflow-x-auto pb-3 -mx-1 px-1 scrollbar-hide">
          {VIBE_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setActiveVibe(f.value)}
              className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-all"
              style={activeVibe === f.value
                ? { background: "#7C3AED", color: "white" }
                : { background: "#F3EEFF", color: "#7C3AED" }
              }
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Results */}
      <div className="px-4 pb-6 flex flex-col gap-3">
        {filtered.length === 0 && !isLoading && (
          <div className="text-center py-16">
            <span className="text-5xl">🧋</span>
            <p className="mt-4 font-bold" style={{ color: "#12082A" }}>No spots found</p>
            <p className="text-sm mt-1" style={{ color: "#6B5B8A" }}>Try searching or be the first to log one!</p>
            <Link href="/log" className="inline-block mt-4 px-4 py-2 rounded-full text-sm font-bold text-white" style={{ background: "#7C3AED" }}>
              Log a spot
            </Link>
          </div>
        )}
        {filtered.map((place: any) => (
          <PlaceCard key={place.id} place={place} />
        ))}
      </div>
    </AppShell>
  )
}
