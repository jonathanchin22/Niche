"use client"

import { formatDistanceToNow } from "date-fns"
import type { Review } from "@niche/shared-types"
import { Stars, MonoLabel } from "@/components/ui/Primitives"

interface Props {
  review: Review
  showAuthor?: boolean
  onClick?: () => void
}

export default function ReviewCard({ review, showAuthor = false, onClick }: Props) {
  const timeAgo = formatDistanceToNow(new Date(review.created_at))
  const mainPhoto = review.image_urls?.[0]

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
          <Stars value={Math.round((review.score / 10) * 5)} />
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
