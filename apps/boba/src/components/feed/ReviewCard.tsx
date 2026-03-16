"use client"

import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@niche/auth/client"
import { likeReview, unlikeReview } from "@niche/database"
import Link from "next/link"

interface ReviewCardProps {
  review: any
  currentUserId: string
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return "just now"
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

function StarRow({ score }: { score: number }) {
  const stars = Math.round(score / 2)
  return (
    <div style={{ display: "flex", gap: 2 }}>
      {[1,2,3,4,5].map(n => (
        <span key={n} style={{
          fontSize: 13,
          color: n <= stars ? "#c9a84c" : "#e8e8e4",
        }}>★</span>
      ))}
    </div>
  )
}

export function ReviewCard({ review, currentUserId }: ReviewCardProps) {
  const supabase = createClient()
  const queryClient = useQueryClient()
  const likeCount = review.upvotes_count ?? review.likes_count ?? 0
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

  const profile = review.profile
  const place = review.place
  const name = profile?.display_name ?? profile?.username ?? "someone"

  return (
    <div style={{
      background: "white",
      border: "1px solid #e8e8e4",
      borderRadius: 12,
      padding: "20px 20px 16px",
      marginBottom: 12,
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 12 }}>
        <div style={{
          width: 36, height: 36, borderRadius: "50%",
          border: "1.5px solid #e8e8e4",
          background: "#e8f4ee",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: "'DM Serif Display', Georgia, serif",
          fontSize: 16, color: "#2d6a4f",
          flexShrink: 0,
        }}>
          {name[0]?.toUpperCase()}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6, flexWrap: "wrap" }}>
            <span style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 15, color: "#1a1a1a" }}>
              {name}
            </span>
            <span style={{ fontFamily: "var(--font-hand)", fontSize: 13, color: "#888" }}>drank at</span>
            <Link href={`/place/${review.place_id}`} style={{
              fontFamily: "'DM Serif Display', Georgia, serif",
              fontSize: 15, color: "#2d6a4f", textDecoration: "none",
            }}>
              {place?.name ?? "a spot"}
            </Link>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
            <StarRow score={review.score} />
            <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: "#bbb" }}>
              {timeAgo(review.created_at)}
            </span>
          </div>
        </div>
        <span style={{
          fontFamily: "'DM Serif Display', Georgia, serif",
          fontSize: 22, color: "#1a1a1a", fontWeight: 400,
        }}>
          {review.score}
        </span>
      </div>

      {/* Body */}
      {review.note && (
        <p style={{
          fontFamily: "var(--font-hand)",
          fontSize: 17, color: "#333",
          lineHeight: 1.5, marginBottom: 12,
          borderLeft: "2px solid #e8f4ee",
          paddingLeft: 12,
        }}>
          {review.note}
        </p>
      )}

      {/* Tags */}
      {review.tags?.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
          {review.tags.map((tag: string) => (
            <span key={tag} style={{
              fontFamily: "'DM Sans', sans-serif", fontSize: 11,
              background: "#e8f4ee", color: "#2d6a4f",
              padding: "3px 10px", borderRadius: 10,
            }}>
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Footer */}
      <div style={{
        borderTop: "1px solid #f0f0ec", paddingTop: 12,
        display: "flex", alignItems: "center", gap: 16,
      }}>
        <button
          onClick={() => toggleLike()}
          style={{
            background: "none", border: "none", cursor: "pointer",
            display: "flex", alignItems: "center", gap: 5,
            fontFamily: "'DM Sans', sans-serif", fontSize: 13,
            color: optimisticLiked ? "#2d6a4f" : "#bbb",
            padding: 0,
          }}
        >
          <span style={{ fontSize: 15 }}>{optimisticLiked ? "♥" : "♡"}</span>
          {optimisticCount > 0 && <span>{optimisticCount}</span>}
        </button>
      </div>
    </div>
  )
}
