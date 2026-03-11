"use client"

import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@niche/auth"
import { likeReview, unlikeReview } from "@niche/database"
import Link from "next/link"

interface ReviewCardProps {
  review: any
  currentUserId: string
}

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 8 ? "#059669" : score >= 6 ? "#D97706" : "#DC2626"
  return (
    <span className="inline-flex items-center justify-center w-9 h-9 rounded-full text-white font-black text-sm flex-shrink-0" style={{ background: color }}>
      {score}
    </span>
  )
}

function Avatar({ profile, size = 36 }: { profile: any; size?: number }) {
  const initials = profile?.display_name?.[0] ?? profile?.username?.[0] ?? "?"
  if (profile?.avatar_url) {
    return <img src={profile.avatar_url} alt={initials} className="rounded-full object-cover flex-shrink-0" style={{ width: size, height: size }} />
  }
  return (
    <div className="rounded-full flex items-center justify-center font-bold text-white flex-shrink-0 text-sm" style={{ width: size, height: size, background: "linear-gradient(135deg, #7C3AED, #9F67FF)" }}>
      {initials.toUpperCase()}
    </div>
  )
}

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

export function ReviewCard({ review, currentUserId }: ReviewCardProps) {
  const supabase = createClient()
  const queryClient = useQueryClient()
  const likeCount = review.likes?.[0]?.count ?? review.likes ?? 0
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
      setOptimisticLiked((prev) => !prev)
      setOptimisticCount((prev) => optimisticLiked ? prev - 1 : prev + 1)
    },
    onError: () => {
      setOptimisticLiked((prev) => !prev)
      setOptimisticCount((prev) => optimisticLiked ? prev + 1 : prev - 1)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["feed"] })
    },
  })

  const profile = review.profile
  const place = review.place
  const name = profile?.display_name ?? profile?.username ?? "Someone"

  return (
    <div className="bg-white rounded-2xl mx-4 mb-3 overflow-hidden shadow-sm border border-purple-50">
      {/* Accent bar */}
      <div className="h-1 w-full" style={{ background: "linear-gradient(90deg, #7C3AED, #C084FC)" }} />

      <div className="p-4">
        {/* Header */}
        <div className="flex items-start gap-3 mb-3">
          <Avatar profile={profile} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-bold text-sm text-gray-900">{name}</span>
              <span className="text-gray-400 text-xs">reviewed</span>
              <Link href={`/place/${review.place_id}`} className="font-semibold text-sm truncate" style={{ color: "#7C3AED" }}>
                {place?.name ?? "a spot"}
              </Link>
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              {place?.address && (
                <span className="text-xs text-gray-400 truncate">{place.address}</span>
              )}
              <span className="text-xs text-gray-300">·</span>
              <span className="text-xs text-gray-400">{timeAgo(review.created_at)}</span>
            </div>
          </div>
          <ScoreBadge score={review.score} />
        </div>

        {/* Body */}
        {review.body && (
          <p className="text-sm text-gray-700 leading-relaxed mb-3">{review.body}</p>
        )}

        {/* Images */}
        {review.image_urls?.length > 0 && (
          <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
            {review.image_urls.map((url: string, i: number) => (
              <img key={i} src={url} alt="" className="w-24 h-24 rounded-xl object-cover flex-shrink-0" />
            ))}
          </div>
        )}

        {/* Tags */}
        {review.tags?.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {review.tags.map((tag: string) => (
              <span key={tag} className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "#F3EEFF", color: "#7C3AED" }}>
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-4 pt-1 border-t border-gray-50">
          <button
            onClick={() => toggleLike()}
            className="flex items-center gap-1.5 text-sm font-medium transition-transform active:scale-90"
            style={{ color: optimisticLiked ? "#7C3AED" : "#9CA3AF" }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill={optimisticLiked ? "#7C3AED" : "none"} stroke="currentColor" strokeWidth="2">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
            </svg>
            {optimisticCount > 0 && <span>{optimisticCount}</span>}
          </button>
        </div>
      </div>
    </div>
  )
}
