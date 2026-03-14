"use client"

import { useInfiniteQuery } from "@tanstack/react-query"
import { createBrowserClient } from "@supabase/ssr"
import { getMyFeed } from "@niche/database"
import ReviewCard from "@/components/feed/ReviewCard"
import { MonoLabel } from "@/components/ui/Primitives"
import type { Review } from "@niche/shared-types"

const APP_ID = "brew" as const

function getSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

interface MyFeedSectionProps {
  userId: string
}

export default function MyFeedSection({ userId }: MyFeedSectionProps) {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useInfiniteQuery({
    queryKey: ["home-my-feed-brew", userId],
    queryFn: ({ pageParam }) =>
      getMyFeed(getSupabase(), { user_id: userId, app_id: APP_ID, cursor: pageParam as string | undefined }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: last => last.has_more ? last.cursor ?? undefined : undefined,
  })

  const feedReviews = data?.pages.flatMap(p => p.data.map(i => i.review).filter(Boolean)) as Review[] ?? []

  if (isLoading) {
    return (
      <div style={{ padding: "20px 28px 0" }}>
        <MonoLabel>loading feed...</MonoLabel>
      </div>
    )
  }

  return (
    <div style={{ padding: "20px 28px 0" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 16 }}>
        <p style={{ fontFamily: "var(--font-display)", fontSize: 20, color: "var(--c-ink)", margin: 0, fontWeight: 400, fontStyle: "italic" }}>
          my feed
        </p>
      </div>

      {feedReviews.length === 0 ? (
        <div style={{ borderTop: "1px solid var(--c-rule)", padding: "24px 0", textAlign: "center" }}>
          <p style={{ fontFamily: "var(--font-hand)", fontSize: 16, color: "var(--c-subtle)" }}>
            Your feed is empty. Start logging drinks or follow friends!
          </p>
        </div>
      ) : (
        <div>
          {feedReviews.slice(0, 3).map(review => (
            <ReviewCard key={review.id} review={review} showAuthor />
          ))}
          {feedReviews.length > 3 && (
            <div style={{ textAlign: "center", marginTop: 16 }}>
              <p style={{ fontFamily: "var(--font-hand)", fontSize: 14, color: "var(--c-subtle)", margin: 0 }}>
                +{feedReviews.length - 3} more in your feed
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}