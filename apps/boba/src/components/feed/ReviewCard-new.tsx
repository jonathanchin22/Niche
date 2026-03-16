"use client"

import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@niche/auth/client"
import { likeReview, unlikeReview } from "@niche/database"
import Link from "next/link"
import Image from "next/image"
import type { Review } from "@niche/shared-types"

interface ReviewCardProps {
  review: Review
  currentUserId: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return "just now"
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d`
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

function scoreToStars(score: number) {
  // score is 0–10; display as 0–5 with half precision
  const stars = score / 2
  const full = Math.floor(stars)
  const half = stars % 1 >= 0.5
  return { full, half, empty: 5 - full - (half ? 1 : 0) }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StarRow({ score }: { score: number }) {
  const { full, half, empty } = scoreToStars(score)
  return (
    <div style={{ display: "flex", gap: 2, alignItems: "center" }}>
      {Array.from({ length: full }).map((_, i) => (
        <span key={`f${i}`} style={{ fontSize: 12, color: "#c9a84c" }}>★</span>
      ))}
      {half && <span style={{ fontSize: 12, color: "#c9a84c" }}>✦</span>}
      {Array.from({ length: empty }).map((_, i) => (
        <span key={`e${i}`} style={{ fontSize: 12, color: "#e8e8e4" }}>★</span>
      ))}
      <span
        style={{
          fontFamily: "'DM Serif Display', Georgia, serif",
          fontSize: 13,
          color: "#888",
          marginLeft: 4,
          fontWeight: 400,
        }}
      >
        {(score / 2).toFixed(1)}
      </span>
    </div>
  )
}

function TasteChip({ label, dim }: { label: string; dim?: boolean }) {
  return (
    <span
      style={{
        display: "inline-block",
        fontSize: 11,
        padding: "2px 8px",
        borderRadius: 10,
        background: dim ? "#f4f4f0" : "#e8f4ee",
        color: dim ? "#aaa" : "#2d6a4f",
        fontFamily: "'DM Sans', sans-serif",
        fontWeight: dim ? 400 : 500,
      }}
    >
      {label}
    </span>
  )
}

function RevisitBadge({ intent }: { intent: boolean | null | undefined }) {
  if (intent === undefined || intent === null) return null
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 3,
        fontSize: 10,
        padding: "2px 7px",
        borderRadius: 10,
        background: intent ? "#e8f4ee" : "#f4f4f0",
        color: intent ? "#2d6a4f" : "#aaa",
        fontFamily: "'DM Sans', sans-serif",
        fontWeight: 500,
      }}
    >
      {intent ? "↻" : "✗"} {intent ? "would revisit" : "one and done"}
    </span>
  )
}

function QualitySignals({ signals }: { signals: any }) {
  if (!signals) return null
  const items = []
  if (signals.pearls) items.push(`pearls: ${signals.pearls}/5`)
  if (signals.tea_base) items.push(`tea: ${signals.tea_base}/5`)
  if (signals.sweetness_accuracy) items.push(`sweetness: ${signals.sweetness_accuracy}/5`)
  if (items.length === 0) return null
  return (
    <div style={{ fontSize: 11, color: "#888", fontFamily: "'DM Sans', sans-serif" }}>
      {items.join(" • ")}
    </div>
  )
}

export function ReviewCard({ review, currentUserId }: ReviewCardProps) {
  const supabase = createClient()
  const queryClient = useQueryClient()
  const likeCount = review.upvotes_count ?? review.likes_count ?? 0
  const commentCount = review.comments_count ?? 0
  const [optimisticLiked, setOptimisticLiked] = useState(review.user_vote === 1)
  const [optimisticCount, setOptimisticCount] = useState(Number(likeCount))

  const { mutate: toggleLike } = useMutation({
    mutationFn: async () => {
      if (optimisticLiked) {
        await unlikeReview(supabase as any, { review_id: review.id, user_id: currentUserId })
      } else {
        await likeReview(supabase as any, { review_id: review.id, user_id: currentUserId })
      }
    },
    onMutate: () => {
      setOptimisticLiked(prev => {
        const next = !prev
        setOptimisticCount(count => (next ? count + 1 : Math.max(0, count - 1)))
        return next
      })
    },
    onError: () => {
      setOptimisticLiked(prev => {
        const next = !prev
        setOptimisticCount(count => (next ? count + 1 : Math.max(0, count - 1)))
        return next
      })
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["feed"] }),
  })

  const tasteChips = []
  if (review.taste_attributes) {
    const ta = review.taste_attributes
    if (ta.drink_type) tasteChips.push(ta.drink_type)
    if (ta.sugar_level !== null && ta.sugar_level !== undefined) tasteChips.push(`${ta.sugar_level}% sugar`)
    if (ta.ice_level) tasteChips.push(ta.ice_level)
    if (ta.pearl_texture) tasteChips.push(ta.pearl_texture)
    if (ta.tea_base) tasteChips.push(ta.tea_base)
  }
  if (review.toppings && review.toppings.length > 0) {
    tasteChips.push(...review.toppings.filter(t => t !== "no topping"))
  }
  if (review.customizations && review.customizations.length > 0) {
    tasteChips.push(...review.customizations)
  }

  return (
    <div style={{
      background: "white",
      borderRadius: 12,
      padding: 16,
      boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
      marginBottom: 12,
    }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <Link href={`/profile/${review.user?.username}`} style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none" }}>
          {review.user?.avatar_url && (
            <Image
              src={review.user.avatar_url}
              alt={review.user.display_name}
              width={32}
              height={32}
              style={{ borderRadius: "50%" }}
            />
          )}
          <div>
            <div style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 14, color: "#1a1a1a", fontWeight: 400 }}>
              {review.user?.display_name}
            </div>
            <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "#888" }}>
              @{review.user?.username} • {timeAgo(review.created_at)}
            </div>
          </div>
        </Link>
        <Link href={`/place/${review.place?.id}`} style={{ textDecoration: "none" }}>
          <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "#666", textAlign: "right" }}>
            {review.place?.name}
          </div>
        </Link>
      </div>

      {/* Rating */}
      <div style={{ marginBottom: 12 }}>
        <StarRow score={review.score} />
      </div>

      {/* Taste attributes */}
      {tasteChips.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
          {tasteChips.map((chip, i) => (
            <TasteChip key={i} label={chip} />
          ))}
        </div>
      )}

      {/* Note */}
      {review.note && (
        <p style={{
          fontFamily: "'DM Sans', sans-serif",
          fontSize: 14,
          color: "#333",
          lineHeight: 1.4,
          margin: "0 0 12px",
        }}>
          {review.note}
        </p>
      )}

      {/* Quality signals */}
      <QualitySignals signals={review.quality_signals} />

      {/* Revisit intent */}
      <RevisitBadge intent={review.revisit_intent} />

      {/* Images */}
      {review.image_urls && review.image_urls.length > 0 && (
        <div style={{ display: "flex", gap: 8, marginTop: 12, overflowX: "auto" }}>
          {review.image_urls.map((url, i) => (
            <Image
              key={i}
              src={url}
              alt=""
              width={120}
              height={120}
              style={{ borderRadius: 8, objectFit: "cover", flexShrink: 0 }}
            />
          ))}
        </div>
      )}

      {/* Footer */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            onClick={() => toggleLike()}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: "none",
              border: "none",
              cursor: "pointer",
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 13,
              color: optimisticLiked ? "#e63946" : "#888",
            }}
          >
            <span style={{ fontSize: 16 }}>{optimisticLiked ? "♥" : "♡"}</span>
            {optimisticCount}
          </button>
          <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "#888" }}>
            {commentCount} comment{commentCount === 1 ? "" : "s"}
          </span>
        </div>
        <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "#888" }}>
          {review.tags?.join(" • ")}
        </div>
      </div>
    </div>
  )
}