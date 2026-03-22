"use client"

import { useEffect, useMemo, useState } from "react"
import { AppShell } from "@/components/ui/AppShell"
import Link from "next/link"
import { createClient } from "@niche/auth/client"
import { isPlaceSaved, savePlaceToList, unsavePlaceFromList } from "@niche/database"

interface PlaceClientProps {
  place: any
  reviews: any[]
  userId: string | null
}

function StarRow({ score }: { score: number }) {
  const stars = Math.round(score / 2)
  return (
    <div style={{ display: "flex", gap: 2 }}>
      {[1,2,3,4,5].map(n => (
        <span key={n} style={{ fontSize: 13, color: n <= stars ? "#c9a84c" : "#e8e8e4" }}>★</span>
      ))}
    </div>
  )
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return "today"
  if (days === 1) return "yesterday"
  if (days < 7) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

export function PlaceClient({ place, reviews, userId }: PlaceClientProps) {
  const supabase = useMemo(() => createClient(), [])
  const [favoritesSaved, setFavoritesSaved] = useState(false)
  const [wantToTrySaved, setWantToTrySaved] = useState(false)
  const [saveMenuOpen, setSaveMenuOpen] = useState(false)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    const hydrate = async () => {
      if (!userId) return
      try {
        const [fav, want] = await Promise.all([
          isPlaceSaved(supabase as any, {
            user_id: userId,
            place_id: place.id,
            app_id: "boba",
            list_type: "favorites",
          }),
          isPlaceSaved(supabase as any, {
            user_id: userId,
            place_id: place.id,
            app_id: "boba",
            list_type: "want_to_try",
          }),
        ])

        if (active) {
          setFavoritesSaved(fav)
          setWantToTrySaved(want)
        }
      } catch {
        // Keep page usable if saves table is not migrated yet.
      }
    }

    void hydrate()

    return () => {
      active = false
    }
  }, [place.id, supabase, userId])

  const toggleSave = async (listType: "favorites" | "want_to_try") => {
    if (!userId) return

    const isSaved = listType === "favorites" ? favoritesSaved : wantToTrySaved
    try {
      if (isSaved) {
        await unsavePlaceFromList(supabase as any, {
          user_id: userId,
          place_id: place.id,
          app_id: "boba",
          list_type: listType,
        })
      } else {
        await savePlaceToList(supabase as any, {
          user_id: userId,
          place_id: place.id,
          app_id: "boba",
          list_type: listType,
        })
      }

      if (listType === "favorites") setFavoritesSaved(!isSaved)
      if (listType === "want_to_try") setWantToTrySaved(!isSaved)
      setSaveMessage(!isSaved ? "saved" : "removed")
      setTimeout(() => setSaveMessage(null), 1500)
    } catch {
      setSaveMessage("save failed")
      setTimeout(() => setSaveMessage(null), 1500)
    }
  }

  const handleSharePlace = async () => {
    const url = `${window.location.origin}/place/${place.id}`
    try {
      if (typeof navigator !== "undefined" && (navigator as any).share) {
        await (navigator as any).share({
          title: place.name,
          text: `check out ${place.name} on boba!`,
          url,
        })
      } else if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(url)
      }
      setSaveMessage("link shared")
      setTimeout(() => setSaveMessage(null), 1500)
    } catch {
      setSaveMessage("share cancelled")
      setTimeout(() => setSaveMessage(null), 1500)
    }
  }

  return (
    <AppShell activeTab="explore">
      <div style={{ padding: "52px 28px 20px", fontFamily: "'DM Sans', sans-serif" }}>

        {/* Back */}
        <Link href="/explore" style={{ textDecoration: "none" }}>
          <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "#888", margin: "0 0 24px" }}>
            ← explore
          </p>
        </Link>

        {/* Place header */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginBottom: 8 }}>
            <div style={{ position: "relative" }}>
              <button
                onClick={() => setSaveMenuOpen((v) => !v)}
                style={{
                  border: "1px solid #dfe6e0",
                  background: "#fff",
                  color: "#2d6a4f",
                  borderRadius: 999,
                  padding: "6px 11px",
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                save
              </button>

              {saveMenuOpen && (
                <div style={{
                  position: "absolute",
                  right: 0,
                  top: 34,
                  width: 180,
                  background: "#fff",
                  border: "1px solid #dfe6e0",
                  borderRadius: 10,
                  boxShadow: "0 6px 20px rgba(0,0,0,0.08)",
                  zIndex: 5,
                  overflow: "hidden",
                }}>
                  <button
                    onClick={() => {
                      void toggleSave("favorites")
                      setSaveMenuOpen(false)
                    }}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      border: "none",
                      borderBottom: "1px solid #eef2ef",
                      background: "#fff",
                      padding: "10px 12px",
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: 12,
                      color: "#223025",
                      cursor: "pointer",
                    }}
                  >
                    {favoritesSaved ? "✓ " : ""}favorites
                  </button>
                  <button
                    onClick={() => {
                      void toggleSave("want_to_try")
                      setSaveMenuOpen(false)
                    }}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      border: "none",
                      background: "#fff",
                      padding: "10px 12px",
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: 12,
                      color: "#223025",
                      cursor: "pointer",
                    }}
                  >
                    {wantToTrySaved ? "✓ " : ""}want to try
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={() => void handleSharePlace()}
              style={{
                border: "1px solid #dfe6e0",
                background: "#fff",
                color: "#2d6a4f",
                borderRadius: 999,
                padding: "6px 11px",
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              share
            </button>
          </div>

          <p style={{ fontFamily: "'Caveat', cursive", fontSize: 14, color: "#888", margin: "0 0 4px" }}>
            {place.city ?? ""}{place.city && place.state ? ", " : ""}{place.state ?? ""}
          </p>
          <h1 style={{
            fontFamily: "'DM Serif Display', Georgia, serif",
            fontSize: 30, color: "#1a1a1a",
            margin: "0 0 8px", fontWeight: 400, lineHeight: 1.1,
          }}>
            {place.name}
          </h1>
          <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "#888", margin: "0 0 16px" }}>
            {place.address}
          </p>

          {/* Stats row */}
          <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
            {place.avg_score && (
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 22, color: "#1a1a1a" }}>
                  {(place.avg_score / 2).toFixed(1)}
                </span>
                <StarRow score={place.avg_score} />
              </div>
            )}
            <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "#bbb" }}>
              {place.review_count ?? reviews.length} reviews
            </span>
          </div>
        </div>

        {saveMessage && (
          <p style={{
            margin: "-14px 0 16px",
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 12,
            color: "#6b746d",
          }}>
            {saveMessage}
          </p>
        )}

        {/* Log CTA */}
        <Link href="/log">
          <button style={{
            width: "100%", background: "#2d6a4f", color: "#fff",
            border: "none", borderRadius: 10, padding: "14px",
            fontFamily: "'DM Sans', sans-serif", fontSize: 15,
            cursor: "pointer", marginBottom: 32,
          }}>
            log a drink here
          </button>
        </Link>

        {/* Reviews */}
        <p style={{ fontFamily: "'Caveat', cursive", fontSize: 18, color: "#1a1a1a", margin: "0 0 16px" }}>
          {reviews.length > 0 ? `${reviews.length} review${reviews.length !== 1 ? "s" : ""}` : "no reviews yet"}
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {reviews.map((r: any) => {
            const name = r.profile?.display_name ?? r.profile?.username ?? "someone"
            return (
              <div key={r.id} style={{
                background: "white", border: "1px solid #e8e8e4",
                borderRadius: 12, padding: "16px 18px",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: "50%",
                    background: "#e8f4ee", border: "1.5px solid #e8e8e4",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontFamily: "'DM Serif Display', Georgia, serif",
                    fontSize: 14, color: "#2d6a4f", flexShrink: 0,
                  }}>
                    {name[0]?.toUpperCase()}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 14, margin: 0, color: "#1a1a1a" }}>
                      {name}
                    </p>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2 }}>
                      <StarRow score={r.score} />
                      <span suppressHydrationWarning style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: "#bbb" }}>
                        {timeAgo(r.created_at)}
                      </span>
                    </div>
                  </div>
                </div>
                {r.body && (
                  <p style={{
                    fontFamily: "'Caveat', cursive", fontSize: 16, color: "#333",
                    margin: "0 0 8px", lineHeight: 1.5,
                    borderLeft: "2px solid #e8f4ee", paddingLeft: 10,
                  }}>
                    {r.body}
                  </p>
                )}
                {r.tags?.length > 0 && (
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {r.tags.map((t: string) => (
                      <span key={t} style={{
                        fontFamily: "'DM Sans', sans-serif", fontSize: 11,
                        background: "#e8f4ee", color: "#2d6a4f",
                        padding: "2px 8px", borderRadius: 10,
                      }}>{t}</span>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </AppShell>
  )
}
