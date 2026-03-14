"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import type { Place, Review } from "@niche/shared-types"
import { Stars, MonoLabel } from "@/components/ui/Primitives"
import ReviewCard from "@/components/feed/ReviewCard"
import ReviewModal from "@/components/review/ReviewModal"

interface Props {
  place: Place
  reviews: Review[]
  userId: string
}

export default function PlaceClient({ place, reviews, userId }: Props) {
  const router = useRouter()
  const [logging, setLogging] = useState(false)

  const avgStars = place.avg_score != null ? Math.round((place.avg_score / 10) * 5) : 0

  return (
    <div style={{ paddingBottom: 20 }}>
      {/* Cover */}
      <div style={{
        height: 220, background: "var(--c-tint)", position: "relative",
        display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden",
      }}>
        {place.cover_image_url ? (
          <img src={place.cover_image_url} alt={place.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <span style={{ fontFamily: "var(--font-display)", fontSize: 18, color: "var(--c-subtle)", fontStyle: "italic" }}>
            {place.name}
          </span>
        )}
        {/* Back button */}
        <button
          type="button"
          onClick={() => router.back()}
          style={{
            position: "absolute", top: 60, left: 20,
            background: "rgba(247,243,238,0.9)", border: "1px solid var(--c-rule)",
            borderRadius: 2, padding: "6px 12px", cursor: "pointer",
            fontFamily: "var(--font-mono)", fontSize: 10,
            color: "var(--c-ink)", letterSpacing: "0.06em",
          }}
        >
          ← back
        </button>
      </div>

      {/* Header */}
      <div style={{ padding: "24px 28px 0" }}>
        <h1 style={{
          fontFamily: "var(--font-display)", fontSize: 30, color: "var(--c-ink)",
          margin: "0 0 4px", fontWeight: 400,
        }}>
          {place.name}
        </h1>
        {(place.city || place.state) && (
          <MonoLabel style={{ marginBottom: 16 }}>
            {[place.city, place.state].filter(Boolean).join(", ")}
          </MonoLabel>
        )}

        {/* Stats bar */}
        <div style={{
          display: "flex", borderTop: "1px solid var(--c-rule)", borderBottom: "1px solid var(--c-rule)",
          padding: "16px 0", marginBottom: 24, gap: 0,
        }}>
          {[
            [place.avg_score != null ? ((place.avg_score / 10) * 5).toFixed(1) : "—", "avg rating"],
            [String(place.review_count), "drinks logged"],
          ].map(([v, l], i) => (
            <div key={l} style={{
              flex: 1, textAlign: "center",
              borderRight: i === 0 ? "1px solid var(--c-rule)" : "none",
            }}>
              <p style={{
                fontFamily: "var(--font-mono)", fontSize: 22, margin: "0 0 2px",
                color: "var(--c-ink)", letterSpacing: "-0.02em",
              }}>
                {v}
              </p>
              <MonoLabel>{l}</MonoLabel>
            </div>
          ))}
        </div>

        {avgStars > 0 && <Stars value={avgStars} />}

        {/* Log CTA */}
        <button
          type="button"
          onClick={() => setLogging(true)}
          style={{
            width: "100%", background: "var(--c-accent)", color: "#fff",
            border: "none", padding: "14px", marginTop: 20,
            fontFamily: "var(--font-mono)", fontSize: 11,
            cursor: "pointer", letterSpacing: "0.1em", textTransform: "uppercase",
          }}
        >
          + log a drink here
        </button>
      </div>

      {/* Reviews */}
      <div style={{ padding: "24px 28px 0" }}>
        <p style={{
          fontFamily: "var(--font-display)", fontSize: 20, color: "var(--c-ink)",
          margin: "0 0 4px", fontWeight: 400, fontStyle: "italic",
        }}>
          what people are saying
        </p>
      </div>

      <div style={{ padding: "0 28px" }}>
        {reviews.length === 0 ? (
          <p style={{ fontFamily: "var(--font-hand)", fontSize: 15, color: "var(--c-subtle)", padding: "20px 0" }}>
            No reviews yet — be the first!
          </p>
        ) : (
          reviews.map(r => (
            <ReviewCard key={r.id} review={r} showAuthor />
          ))
        )}
      </div>

      {/* Log modal */}
      {logging && (
        <ReviewModal
          userId={userId}
          onSuccess={() => { setLogging(false); router.refresh() }}
          onClose={() => setLogging(false)}
        />
      )}
    </div>
  )
}
