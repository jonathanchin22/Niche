"use client"

import { formatDistanceToNow } from "date-fns"
import type { Review } from "@niche/shared-types"
import { useState } from "react"
import { createBrowserClient } from "@supabase/ssr"
import { voteReview, removeReviewVote } from "@niche/database"
import { Stars, MonoLabel } from "@/components/ui/Primitives"

interface Props {
  review: Review
  currentUserId?: string
  showAuthor?: boolean
  onClick?: () => void
}

function getSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export default function ReviewCard({ review, currentUserId, showAuthor = false, onClick }: Props) {
  const timeAgo = formatDistanceToNow(new Date(review.created_at))
  const mainPhoto = review.image_urls?.[0]

  // Voting state
  const [upvotes, setUpvotes] = useState(review.upvotes_count ?? 0)
  const [downvotes, setDownvotes] = useState(review.downvotes_count ?? 0)
  const [userVote, setUserVote] = useState<1 | -1 | 0>(review.user_vote ?? 0)
  const [isVoting, setIsVoting] = useState(false)

  const commentCount = review.comments_count ?? ((review as any).comments?.length ?? 0)

  const handleVote = async (vote: 1 | -1) => {
    if (isVoting || !currentUserId) return
    setIsVoting(true)
    const supabase = getSupabase()
    if (userVote === vote) {
      // Undo vote
      if (vote === 1) setUpvotes(u => u - 1)
      if (vote === -1) setDownvotes(d => d - 1)
      setUserVote(0)
      await removeReviewVote(supabase, { review_id: review.id, user_id: currentUserId })
    } else {
      if (vote === 1) {
        setUpvotes(u => u + 1)
        if (userVote === -1) setDownvotes(d => d - 1)
      } else {
        setDownvotes(d => d + 1)
        if (userVote === 1) setUpvotes(u => u - 1)
      }
      setUserVote(vote)
      await voteReview(supabase, { review_id: review.id, user_id: currentUserId, vote })
    }
    setIsVoting(false)
  }

  return (
    <div
      onClick={onClick}
      style={{ cursor: onClick ? "pointer" : "default", borderBottom: "1px solid var(--c-rule)" }}
    >
      {/* Photo */}
      {mainPhoto && (
        <div style={{ height: 200, overflow: "hidden", marginBottom: 0 }}>
          <img
            src={mainPhoto}
            alt={review.item_name ?? ""}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        </div>
      )}

      <div style={{ padding: "16px 0 20px" }}>
        {/* Drink + rating row */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
          <div>
            <p style={{
              fontFamily: "var(--font-display)",
              fontSize: 20,
              color: "var(--c-ink)",
              margin: "0 0 2px",
              fontWeight: 400,
            }}>
              {review.item_name ?? review.category ?? "brew"}
            </p>
            {review.place && (
              <MonoLabel>{review.place.name}</MonoLabel>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Stars value={(review.score / 10) * 5} size={20} />
            <MonoLabel style={{ fontSize: 10 }}>{review.score?.toFixed(1)}</MonoLabel>
          </div>
        </div>

        {/* Tasting note tags */}
        {review.tags?.length > 0 && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "10px 0" }}>
            {review.tags.map(tag => (
              <span key={tag} style={{
                fontFamily: "var(--font-mono)",
                fontSize: 9,
                color: "var(--c-accent)",
                background: "var(--c-accent-bg)",
                padding: "2px 8px",
                borderRadius: 2,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
              }}>
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Written note */}
        {review.note && (
          <p style={{
            fontFamily: "var(--font-hand)",
            fontSize: 15,
            color: "var(--c-mid)",
            margin: "8px 0 10px",
            lineHeight: 1.4,
          }}>
            &ldquo;{review.note}&rdquo;
          </p>
        )}

        {/* Voting and comments row */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              type="button"
              onClick={e => { e.stopPropagation(); handleVote(1) }}
              disabled={isVoting}
              style={{
                background: userVote === 1 ? "#e8f4ee" : "#fff",
                color: userVote === 1 ? "#2d6a4f" : "#888",
                border: "1px solid #e8e8e4",
                borderRadius: 6,
                padding: "2px 8px",
                fontWeight: 600,
                cursor: "pointer"
              }}
            >▲ {upvotes}</button>
            <button
              type="button"
              onClick={e => { e.stopPropagation(); handleVote(-1) }}
              disabled={isVoting}
              style={{
                background: userVote === -1 ? "#fbeee6" : "#fff",
                color: userVote === -1 ? "#c0392b" : "#888",
                border: "1px solid #e8e8e4",
                borderRadius: 6,
                padding: "2px 8px",
                fontWeight: 600,
                cursor: "pointer"
              }}
            >▼ {downvotes}</button>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--c-subtle)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
              {commentCount} comment{commentCount === 1 ? "" : "s"}
            </span>
          </div>
        </div>

        {/* Footer — reviewed by + time */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
          {showAuthor && (() => {
            const reviewer = (review as any).profile ?? (review as any).user
            if (!reviewer) return <div />
            return (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{
                  width: 24, height: 24, borderRadius: 2,
                  background: "var(--c-accent-bg)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  overflow: "hidden",
                }}>
                  {reviewer.avatar_url ? (
                    <img src={reviewer.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    <span style={{ fontFamily: "var(--font-display)", fontSize: 12, color: "var(--c-accent)" }}>
                      {reviewer.username?.[0]?.toUpperCase()}
                    </span>
                  )}
                </div>
                <div>
                  <MonoLabel style={{ fontSize: 10, display: "block" }}>reviewed by</MonoLabel>
                  <MonoLabel style={{ fontSize: 12 }}>@{reviewer.username}</MonoLabel>
                </div>
              </div>
            )
          })()}
          <MonoLabel>{timeAgo} ago</MonoLabel>
        </div>
      </div>
    </div>
  )
}
