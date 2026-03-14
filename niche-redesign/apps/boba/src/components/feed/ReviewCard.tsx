"use client"

import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@niche/auth/client"
import { likeReview, unlikeReview } from "@niche/database"
import { ReviewModal } from "@/components/review/ReviewModal"
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
  const pct = score / 10
  return (
    <div style={{ display: "flex", gap: 2 }}>
      {[0, 1, 2, 3, 4].map(i => {
        const fill = Math.max(0, Math.min(1, pct * 5 - i))
        const gid = `sr-rc-${i}-${Math.round(score * 10)}`
        return (
          <svg key={i} width="13" height="13" viewBox="0 0 24 24">
            <defs><linearGradient id={gid}><stop offset={`${fill * 100}%`} stopColor="#c9a84c" /><stop offset={`${fill * 100}%`} stopColor="#e8e8e4" /></linearGradient></defs>
            <path d="M12 2l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17l-5.9 3 1.2-6.5L2.5 9l6.6-.9z" fill={`url(#${gid})`} />
          </svg>
        )
      })}
    </div>
  )
}

// Inline photo strip — shows up to 3 photos, tappable
function PhotoStrip({ urls, onTap }: { urls: string[]; onTap: () => void }) {
  if (!urls || urls.length === 0) return null
  const shown = urls.slice(0, 3)
  const extra = urls.length - 3
  return (
    <div
      onClick={e => { e.stopPropagation(); onTap() }}
      style={{
        display: "grid",
        gridTemplateColumns: shown.length === 1 ? "1fr" : shown.length === 2 ? "1fr 1fr" : "2fr 1fr",
        gap: 3, borderRadius: 10, overflow: "hidden", marginBottom: 12, cursor: "pointer",
      }}
    >
      {shown.length === 3 ? (
        <>
          <img src={shown[0]} alt="" style={{ width: "100%", aspectRatio: "1/1", objectFit: "cover", display: "block" }} />
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <img src={shown[1]} alt="" style={{ width: "100%", flex: 1, objectFit: "cover", display: "block", minHeight: 0 }} />
            <div style={{ position: "relative", flex: 1, minHeight: 0 }}>
              <img src={shown[2]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
              {extra > 0 && (
                <div style={{
                  position: "absolute", inset: 0,
                  background: "rgba(0,0,0,0.45)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "#fff", fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 18,
                }}>+{extra}</div>
              )}
            </div>
          </div>
        </>
      ) : (
        shown.map((url, i) => (
          <div key={i} style={{ position: "relative" }}>
            <img src={url} alt="" style={{ width: "100%", aspectRatio: "4/3", objectFit: "cover", display: "block" }} />
            {i === shown.length - 1 && extra > 0 && (
              <div style={{
                position: "absolute", inset: 0, background: "rgba(0,0,0,0.45)",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#fff", fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 18,
              }}>+{extra}</div>
            )}
          </div>
        ))
      )}
    </div>
  )
}

export function ReviewCard({ review: initialReview, currentUserId }: ReviewCardProps) {
  const supabase = createClient()
  const queryClient = useQueryClient()
  const [review, setReview] = useState(initialReview)
  const [modalOpen, setModalOpen] = useState(false)
  const likeCount = review.likes?.[0]?.count ?? 0
  const [optimisticLiked, setOptimisticLiked] = useState(false)
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
      setOptimisticLiked(prev => !prev)
      setOptimisticCount(prev => optimisticLiked ? prev - 1 : prev + 1)
    },
    onError: () => {
      setOptimisticLiked(prev => !prev)
      setOptimisticCount(prev => optimisticLiked ? prev + 1 : prev - 1)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["feed"] }),
  })

  const profile = review.profile
  const place = review.place
  const name = profile?.display_name ?? profile?.username ?? "someone"
  const photos: string[] = review.image_urls ?? []

  return (
    <>
      <div
        onClick={() => setModalOpen(true)}
        style={{
          background: "white",
          border: "1px solid #e8e8e4",
          borderRadius: 12,
          padding: "18px 18px 14px",
          marginBottom: 12,
          cursor: "pointer",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 12 }}>
          <div style={{
            width: 36, height: 36, borderRadius: "50%",
            border: "1.5px solid #e8e8e4", background: "#e8f4ee",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: "'DM Serif Display', Georgia, serif",
            fontSize: 16, color: "#2d6a4f", flexShrink: 0,
          }}>
            {name[0]?.toUpperCase()}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6, flexWrap: "wrap" }}>
              <span style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 15, color: "#1a1a1a" }}>
                {name}
              </span>
              <span style={{ fontFamily: "'Caveat', cursive", fontSize: 13, color: "#888" }}>drank at</span>
              <Link
                href={`/place/${review.place_id}`}
                onClick={e => e.stopPropagation()}
                style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 15, color: "#2d6a4f", textDecoration: "none" }}
              >
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
            fontSize: 22, color: "#1a1a1a", fontWeight: 400, flexShrink: 0,
          }}>
            {typeof review.score === "number" ? review.score.toFixed(1) : review.score}
          </span>
        </div>

        {/* Item name */}
        {review.item_name && (
          <p style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 15, color: "#444", margin: "0 0 10px" }}>
            {review.item_name}
          </p>
        )}

        {/* Photos */}
        <PhotoStrip urls={photos} onTap={() => setModalOpen(true)} />

        {/* Body */}
        {review.body && (
          <p style={{
            fontFamily: "'Caveat', cursive", fontSize: 17, color: "#333",
            lineHeight: 1.5, marginBottom: 10,
            borderLeft: "2px solid #e8f4ee", paddingLeft: 12,
            display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical" as any,
            overflow: "hidden",
          }}>
            {review.body}
          </p>
        )}

        {/* Tags */}
        {review.tags?.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
            {review.tags.map((tag: string) => (
              <span key={tag} style={{
                fontFamily: "'DM Sans', sans-serif", fontSize: 11,
                background: "#e8f4ee", color: "#2d6a4f",
                padding: "3px 10px", borderRadius: 10,
              }}>{tag}</span>
            ))}
          </div>
        )}

        {/* Footer */}
        <div style={{
          borderTop: "1px solid #f0f0ec", paddingTop: 10,
          display: "flex", alignItems: "center", gap: 16,
        }}>
          <button
            onClick={e => { e.stopPropagation(); toggleLike() }}
            style={{
              background: "none", border: "none", cursor: "pointer",
              display: "flex", alignItems: "center", gap: 5,
              fontFamily: "'DM Sans', sans-serif", fontSize: 13,
              color: optimisticLiked ? "#2d6a4f" : "#bbb", padding: 0,
            }}
          >
            <span style={{ fontSize: 15 }}>{optimisticLiked ? "♥" : "♡"}</span>
            {optimisticCount > 0 && <span>{optimisticCount}</span>}
          </button>
          {photos.length > 0 && (
            <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: "#bbb" }}>
              {photos.length} photo{photos.length !== 1 ? "s" : ""}
            </span>
          )}
          <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: "#bbb", marginLeft: "auto" }}>
            tap to expand
          </span>
        </div>
      </div>

      {/* Modal */}
      {modalOpen && (
        <ReviewModal
          review={review}
          currentUserId={currentUserId}
          onClose={() => setModalOpen(false)}
          onUpdated={updated => setReview({ ...review, ...updated })}
        />
      )}
    </>
  )
}
