"use client"

import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@niche/auth"
import { likeReview, unlikeReview } from "@niche/database"
import type { Review } from "@niche/shared-types"
import Image from "next/image"
import Link from "next/link"

interface ReviewCardProps {
  review: Review
  currentUserId: string
}

const BADGE_STYLES: Record<string, string> = {
  "Boba Royalty": "bg-purple-100 text-purple-700",
  "Explorer": "bg-blue-100 text-blue-700",
  "Century Club": "bg-amber-100 text-amber-700",
}

export function ReviewCard({ review, currentUserId }: ReviewCardProps) {
  const supabase = createClient()
  const queryClient = useQueryClient()
  const [optimisticLiked, setOptimisticLiked] = useState(review.user_has_liked ?? false)
  const [optimisticCount, setOptimisticCount] = useState(review.likes_count ?? 0)

  const likeMutation = useMutation({
    mutationFn: async () => {
      if (optimisticLiked) {
        await unlikeReview(supabase as any, { review_id: review.id, user_id: currentUserId })
      } else {
        await likeReview(supabase as any, { review_id: review.id, user_id: currentUserId })
      }
    },
    onMutate: () => {
      // Optimistic update — feels instant
      setOptimisticLiked((prev) => !prev)
      setOptimisticCount((prev) => optimisticLiked ? prev - 1 : prev + 1)
    },
    onError: () => {
      // Revert on error
      setOptimisticLiked((prev) => !prev)
      setOptimisticCount((prev) => optimisticLiked ? prev + 1 : prev - 1)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["feed", "boba"] })
    },
  })

  const user = review.user
  const place = review.place

  return (
    <article className="mx-3 mb-3 bg-white rounded-2xl overflow-hidden shadow-sm border border-boba-divider">
      {/* Accent bar */}
      <div className="h-1 bg-gradient-to-r from-boba-accent to-boba-accent/50" />

      <div className="p-4">
        {/* User row */}
        <div className="flex items-center gap-3 mb-3">
          <Link href={`/u/${user?.username}`}>
            {user?.avatar_url ? (
              <Image
                src={user.avatar_url}
                alt={user.display_name}
                width={36}
                height={36}
                className="rounded-full"
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-boba-soft flex items-center justify-center text-boba-accent font-black text-sm">
                {user?.display_name?.[0]?.toUpperCase()}
              </div>
            )}
          </Link>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Link href={`/u/${user?.username}`} className="text-[13px] font-bold text-boba-text">
                @{user?.username}
              </Link>
            </div>
            <p className="text-[10px] text-boba-tertiary truncate">
              {place?.city}, {place?.state} · {formatTime(review.created_at)}
            </p>
          </div>

          {/* Score */}
          <StarScore score={review.score} />
        </div>

        {/* Place */}
        <div className="mb-3">
          <Link href={`/places/${review.place_id}`}>
            <h3 className="text-base font-extrabold text-boba-text leading-tight">
              {place?.name}
            </h3>
          </Link>
          {review.category && (
            <div className="flex items-center gap-2 mt-1.5">
              <span className="text-[10px] font-bold bg-boba-soft text-boba-accent px-2.5 py-0.5 rounded-full">
                {review.category}
              </span>
              {review.item_name && (
                <span className="text-[11px] text-boba-secondary">— {review.item_name}</span>
              )}
            </div>
          )}
        </div>

        {/* Note */}
        {review.note && (
          <div className="bg-boba-soft border-l-2 border-boba-accent rounded-r-xl rounded-l-sm px-3 py-2.5 mb-3">
            <p className="text-[12px] text-boba-secondary italic leading-relaxed">
              "{review.note}"
            </p>
          </div>
        )}

        {/* Vibe tags */}
        {review.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {review.tags.map((tag) => (
              <span key={tag} className="text-[10px] text-boba-tertiary bg-gray-50 px-2 py-0.5 rounded-full border border-boba-divider">
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => likeMutation.mutate()}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-bold border transition-all ${
              optimisticLiked
                ? "bg-boba-accent text-white border-boba-accent"
                : "bg-transparent text-boba-tertiary border-boba-divider"
            }`}
          >
            {optimisticLiked ? "♥" : "♡"} {optimisticCount}
          </button>

          <Link
            href={`/reviews/${review.id}#comments`}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-bold border border-boba-divider text-boba-tertiary"
          >
            💬 {review.comments_count ?? 0}
          </Link>

          <button className="ml-auto text-boba-tertiary text-base">⤴</button>
        </div>
      </div>
    </article>
  )
}

function StarScore({ score }: { score: number }) {
  const full = Math.floor(score)
  const half = score % 1 >= 0.5
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className={`text-sm leading-none ${
            i <= full
              ? "text-boba-accent"
              : i === full + 1 && half
              ? "text-boba-accent opacity-50"
              : "text-boba-divider"
          }`}
        >
          ★
        </span>
      ))}
    </div>
  )
}

function formatTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  return `${Math.floor(hours / 24)}d`
}
