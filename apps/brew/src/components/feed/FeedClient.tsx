"use client"

import { useState, useCallback } from "react"
import { useInfiniteQuery } from "@tanstack/react-query"
import { createBrowserClient } from "@supabase/ssr"
import { getFriendFeed } from "@niche/database"
import ReviewCard from "./ReviewCard"
import ReviewDetailModal from "@/components/review/ReviewDetailModal"
import { MonoLabel } from "@/components/ui/Primitives"
import type { FeedItem } from "@niche/shared-types"

const APP_ID = "brew" as const

function getSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export default function FeedClient({ userId }: { userId: string }) {
  const [tab, setTab] = useState<"feed" | "photos">("feed")

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useInfiniteQuery({
    queryKey: ["brew-friend-feed", userId],
    queryFn: ({ pageParam }) =>
      getFriendFeed(getSupabase(), { user_id: userId, app_id: APP_ID, cursor: pageParam as string | undefined }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.has_more ? last.cursor ?? undefined : undefined,
  })

  const reviews = data?.pages.flatMap(p => p.data.map(item => item.review).filter(Boolean)) ?? []
  const withPhotos = reviews.filter(r => r!.image_urls?.length > 0)

  return (
    <div style={{ paddingBottom: 20 }}>
      {/* Tabs */}
      <div style={{
        display: "flex",
        borderTop: "1px solid var(--c-rule)",
        borderBottom: "1px solid var(--c-rule)",
        marginTop: 20,
      }}>
        {(["feed", "photos"] as const).map(t => (
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
          <p style={{ fontFamily: "var(--font-hand)", fontSize: 16, color: "var(--c-subtle)", lineHeight: 1.5 }}>
            Follow friends to see their brew picks here.
          </p>
        </div>
      )}

      {/* Feed tab */}
      {!isLoading && tab === "feed" && (
        <div style={{ padding: "0 28px" }}>
          {reviews.map(r => r && (
            <ReviewCard key={r.id} review={r} showAuthor />
          ))}
          {hasNextPage && (
            <button
              onClick={() => fetchNextPage()}
              const [selectedReview, setSelectedReview] = useState<any | null>(null)

              return (
                <div style={{ paddingBottom: 20 }}>
                  {/* Tabs */}
                  <div style={{
                    display: "flex",
                    borderTop: "1px solid var(--c-rule)",
                    borderBottom: "1px solid var(--c-rule)",
                    marginTop: 20,
                  }}>
                    {(["feed", "photos"] as const).map(t => (
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
                      <p style={{ fontFamily: "var(--font-hand)", fontSize: 16, color: "var(--c-subtle)", lineHeight: 1.5 }}>
                        Follow friends to see their brew picks here.
                      </p>
                    </div>
                  )}

                  {/* Feed tab */}
                  {!isLoading && tab === "feed" && (
                    <div style={{ padding: "0 28px" }}>
                      {reviews.map(r => r && (
                        <ReviewCard key={r.id} review={r} showAuthor onClick={() => setSelectedReview(r)} />
                      ))}
                      {hasNextPage && (
                        <button
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
                          {isFetchingNextPage ? "loading..." : "load more "}
                        </button>
                      )}
                    </div>
                  )}

                  {/* Photos tab */}
                  {!isLoading && tab === "photos" && (
                    <div style={{ padding: "16px 28px" }}>
                      {withPhotos.length === 0 ? (
                        <p style={{ fontFamily: "var(--font-hand)", fontSize: 15, color: "var(--c-subtle)" }}>
                          No photos from friends yet.
                        </p>
                      ) : (
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                          {withPhotos.map(r => r && (
                            <ReviewCard key={r.id} review={r} showAuthor onClick={() => setSelectedReview(r)} />
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {selectedReview && (
                    <ReviewDetailModal
                      review={selectedReview}
                      currentUserId={userId}
                      onClose={() => setSelectedReview(null)}
                    />
                  )}
                </div>
              )
