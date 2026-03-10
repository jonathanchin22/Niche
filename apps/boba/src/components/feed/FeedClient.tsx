"use client"

import { useInfiniteQuery } from "@tanstack/react-query"
import { createClient } from "@niche/auth"
import { getFriendFeed } from "@niche/database"
import { ReviewCard } from "./ReviewCard"
import { AppShell } from "@/components/ui/AppShell"
import type { PaginatedResponse, FeedItem } from "@niche/shared-types"
import { useEffect, useRef } from "react"

interface FeedClientProps {
  initialData: PaginatedResponse<FeedItem>
  userId: string
}

export function FeedClient({ initialData, userId }: FeedClientProps) {
  const supabase = createClient()
  const loadMoreRef = useRef<HTMLDivElement>(null)

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ["feed", "boba", userId],
    queryFn: ({ pageParam }) =>
      getFriendFeed(supabase, {
        user_id: userId,
        app_id: "boba",
        cursor: pageParam as string | undefined,
      }),
    initialPageParam: undefined,
    getNextPageParam: (lastPage) => lastPage.cursor ?? undefined,
    initialData: {
      pages: [initialData],
      pageParams: [undefined],
    },
  })

  // Infinite scroll with IntersectionObserver
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage()
        }
      },
      { threshold: 0.1 }
    )
    const el = loadMoreRef.current
    if (el) observer.observe(el)
    return () => observer.disconnect()
  }, [fetchNextPage, hasNextPage, isFetchingNextPage])

  const items = data?.pages.flatMap((p) => p.data) ?? []

  return (
    <AppShell activeTab="friends">
      <div className="pb-6 pt-2">
        {items.length === 0 ? (
          <EmptyFeed />
        ) : (
          items.map((item, i) => (
            item.review && (
              <ReviewCard
                key={item.review.id ?? i}
                review={item.review}
                currentUserId={userId}
              />
            )
          ))
        )}
        <div ref={loadMoreRef} className="py-4 flex justify-center">
          {isFetchingNextPage && (
            <div className="w-6 h-6 rounded-full border-2 border-boba-accent border-t-transparent animate-spin" />
          )}
        </div>
      </div>
    </AppShell>
  )
}

function EmptyFeed() {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-8 text-center">
      <span className="text-5xl mb-4">🧋</span>
      <h3 className="text-lg font-bold text-boba-text mb-2">No reviews yet</h3>
      <p className="text-sm text-boba-muted leading-relaxed">
        Follow some friends or log your first cup to get started.
      </p>
    </div>
  )
}
