"use client"

import { useState, useEffect, useTransition } from "react"
import { createBrowserClient } from "@supabase/ssr"
import { searchPlaces } from "@niche/database"
import { MonoLabel, Stars, AeroSketch } from "@/components/ui/Primitives"
import type { Place } from "@niche/shared-types"
import Link from "next/link"

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
  const [catIdx, setCatIdx] = useState(0)
  const [places, setPlaces] = useState<Place[]>([])
  const [isPending, startTransition] = useTransition()

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
        <div style={{ padding: "0 20px 12px" }}>
          <p style={{
            fontFamily: "var(--font-display)", fontSize: 24, color: "var(--c-ink)",
            margin: 0, fontWeight: 400, fontStyle: "italic",
          }}>
            {cat.label}
          </p>
        </div>

        {isPending && (
          <div style={{ padding: "24px 20px" }}>
            <MonoLabel>searching...</MonoLabel>
          </div>
        )}

        {!isPending && places.length === 0 && (
          <div style={{ padding: "32px 20px", textAlign: "center" }}>
            <AeroSketch />
            <p style={{ fontFamily: "var(--font-hand)", fontSize: 15, color: "var(--c-subtle)", marginTop: 16 }}>
              No cafes logged here yet.
            </p>
          </div>
        )}

        {!isPending && places.map(place => (
          <Link key={place.id} href={`/place/${place.id}`} style={{ textDecoration: "none" }}>
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
                      {((place.avg_score / 10) * 5).toFixed(1)}
                    </span>
                  )}
                  <Stars value={place.avg_score != null ? Math.round((place.avg_score / 10) * 5) : 0} />
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
