"use client"

import { useInfiniteQuery } from "@tanstack/react-query"
import { createClient } from "@niche/auth"
import { getFriendFeed } from "@niche/database"
import { ReviewCard } from "./ReviewCard"
import { AppShell } from "@/components/ui/AppShell"
import type { PaginatedResponse, FeedItem } from "@niche/shared-types"
import { useEffect, useRef } from "react"
import Link from "next/link"

interface FeedClientProps {
  initialData: PaginatedResponse<FeedItem>
  userId: string
}

export function FeedClient({ initialData, userId }: FeedClientProps) {
  const supabase = createClient()
  const loadMoreRef = useRef<HTMLDivElement>(null)

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ["feed", "boba", userId],
    queryFn: ({ pageParam }: { pageParam: string | undefined }) =>
      getFriendFeed(supabase as any, {
        user_id: userId,
        app_id: "boba",
        cursor: pageParam,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.cursor ?? undefined,
    initialData: {
      pages: [initialData],
      pageParams: [undefined],
    },
  })

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
          items.map((item, i) =>
            item.review ? (
              <ReviewCard
                key={item.review.id ?? i}
                review={item.review}
                currentUserId={userId}
              />
            ) : null
          )
        )}
        <div ref={loadMoreRef} className="py-4 flex justify-center">
          {isFetchingNextPage && (
            <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "#7C3AED", borderTopColor: "transparent" }} />
          )}
        </div>
      </div>
    </AppShell>
  )
}

function EmptyFeed() {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-8 text-center">
      <span className="text-6xl mb-4">🧋</span>
      <h3 className="text-xl font-black mb-2" style={{ color: "#12082A" }}>Your feed is empty</h3>
      <p className="text-sm leading-relaxed mb-6" style={{ color: "#6B5B8A" }}>
        Log your first boba or find friends to follow to get started.
      </p>
      <div className="flex gap-3">
        <Link
          href="/log"
          className="px-4 py-2 rounded-full text-sm font-bold text-white"
          style={{ background: "linear-gradient(135deg, #7C3AED, #9F67FF)" }}
        >
          Log a drink
        </Link>
        <Link
          href="/friends"
          className="px-4 py-2 rounded-full text-sm font-bold border-2"
          style={{ borderColor: "#7C3AED", color: "#7C3AED" }}
        >
          Find friends
        </Link>
      </div>
    </div>
  )
}
