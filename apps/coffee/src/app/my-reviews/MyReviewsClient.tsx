"use client"

import { useState } from "react"
import { useInfiniteQuery } from "@tanstack/react-query"
import { createBrowserClient } from "@supabase/ssr"
import { getUserReviews } from "@niche/database"
import ReviewCard from "@/components/feed/ReviewCard"
import { MonoLabel } from "@/components/ui/Primitives"
import type { Review } from "@niche/shared-types"

const APP_ID = "coffee" as const

function getSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export default function MyReviewsClient({ userId }: { userId: string }) {
  const [tab, setTab] = useState<"reviews" | "photos">("reviews")

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useInfiniteQuery({
    queryKey: ["my-coffee-reviews", userId],
    queryFn: ({ pageParam }) =>
      getUserReviews(getSupabase(), { user_id: userId, app_id: APP_ID, cursor: pageParam as string | undefined }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: last => last.has_more ? last.cursor ?? undefined : undefined,
  })

  const reviews = data?.pages.flatMap(p => p.data.map(i => i.review).filter(Boolean)) as Review[] ?? []
  const withPhotos = reviews.filter(r => r.image_urls?.length > 0)

  return (
    <div>
      {/* Tabs */}
      <div style={{ display: "flex", borderTop: "1px solid var(--c-rule)", borderBottom: "1px solid var(--c-rule)" }}>
        {(["reviews", "photos"] as const).map(t => (
          <button key={t} type="button" onClick={() => setTab(t)} style={{
            flex: 1, padding: "12px", background: "none", border: "none",
            borderBottom: `2px solid ${tab === t ? "var(--c-accent)" : "transparent"}`,
            fontFamily: "var(--font-mono)", fontSize: 9,
            color: tab === t ? "var(--c-accent)" : "var(--c-subtle)",
            cursor: "pointer", letterSpacing: "0.12em", textTransform: "uppercase",
            marginBottom: -1,
          }}>
            {t}
          </button>
        ))}
      </div>

      {isLoading && (
        <div style={{ padding: "40px 28px", textAlign: "center" }}>
          <MonoLabel>loading...</MonoLabel>
        </div>
      )}

      {!isLoading && reviews.length === 0 && (
        <div style={{ padding: "40px 28px", textAlign: "center" }}>
          <p style={{ fontFamily: "var(--font-hand)", fontSize: 16, color: "var(--c-subtle)" }}>
            No drinks logged yet. Tap + to start!
          </p>
        </div>
      )}

      {/* Reviews tab */}
      {!isLoading && tab === "reviews" && (
        <div style={{ padding: "0 28px" }}>
          {reviews.map(r => (
            <ReviewCard key={r.id} review={r} />
          ))}
          {hasNextPage && (
            <button
              type="button"
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
              style={{
                width: "100%", padding: "16px", marginTop: 16,
                background: "none", border: "1px solid var(--c-rule)",
                fontFamily: "var(--font-mono)", fontSize: 10,
                color: "var(--c-subtle)", cursor: "pointer",
                letterSpacing: "0.08em", textTransform: "uppercase",
              }}
            >
              {isFetchingNextPage ? "loading..." : "load more →"}
            </button>
          )}
        </div>
      )}

      {/* Photos tab */}
      {!isLoading && tab === "photos" && (
        <div style={{ padding: "16px 28px" }}>
          {withPhotos.length === 0 ? (
            <p style={{ fontFamily: "var(--font-hand)", fontSize: 15, color: "var(--c-subtle)" }}>
              No photos yet — add one when logging a drink.
            </p>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              {withPhotos.map(r => (
                <div key={r.id} style={{ borderRadius: 4, overflow: "hidden", background: "var(--c-tint)", position: "relative", paddingBottom: "100%" }}>
                  <img
                    src={r.image_urls[0]}
                    alt={r.item_name ?? ""}
                    style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
                  />
                  <div style={{
                    position: "absolute", bottom: 0, left: 0, right: 0,
                    background: "linear-gradient(transparent, rgba(28,20,16,0.65))",
                    padding: "8px",
                  }}>
                    <p style={{ fontFamily: "var(--font-display)", fontSize: 11, color: "#fff", margin: 0 }}>
                      {r.item_name}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
