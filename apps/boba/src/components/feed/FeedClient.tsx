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
    initialData: { pages: [initialData], pageParams: [undefined] },
  })

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) fetchNextPage()
      },
      { threshold: 0.1 }
    )
    const el = loadMoreRef.current
    if (el) observer.observe(el)
    return () => observer.disconnect()
  }, [fetchNextPage, hasNextPage, isFetchingNextPage])

  const items = data?.pages.flatMap((p) => p.data) ?? []

  return (
    <AppShell activeTab="home">
      <div style={{ padding: "52px 20px 20px" }}>
        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <p style={{ fontFamily: "'Caveat', cursive", fontSize: 15, color: "#888", margin: "0 0 4px" }}>
            good to see you
          </p>
          <h1 style={{
            fontFamily: "'DM Serif Display', Georgia, serif",
            fontSize: 32, color: "#1a1a1a",
            margin: 0, fontWeight: 400, lineHeight: 1.1,
          }}>
            your boba<br />world
          </h1>
        </div>

        {items.length === 0 ? (
          <EmptyFeed />
        ) : (
          <>
            {items.map((item, i) =>
              item.review ? (
                <ReviewCard key={item.review.id ?? i} review={item.review} currentUserId={userId} />
              ) : null
            )}
            <div ref={loadMoreRef} style={{ padding: "16px 0", display: "flex", justifyContent: "center" }}>
              {isFetchingNextPage && (
                <span style={{ fontFamily: "'Caveat', cursive", fontSize: 16, color: "#bbb" }}>
                  loading more...
                </span>
              )}
            </div>
          </>
        )}
      </div>
    </AppShell>
  )
}

function EmptyFeed() {
  return (
    <div style={{ padding: "20px 0 40px" }}>
      {/* Sketch placeholder */}
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center",
        gap: 16, marginBottom: 40,
      }}>
        <svg width="120" height="160" viewBox="0 0 120 160" fill="none">
          <path d="M35 30 L85 30 L78 140 L42 140 Z" stroke="#1a1a1a" strokeWidth="2" strokeLinecap="round" fill="none"/>
          <path d="M30 30 Q60 22 90 30" stroke="#1a1a1a" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
          <line x1="60" y1="20" x2="60" y2="-5" stroke="#1a1a1a" strokeWidth="1.5" strokeLinecap="round"/>
          <circle cx="47" cy="110" r="6" stroke="#1a1a1a" strokeWidth="1.5" fill="none"/>
          <circle cx="63" cy="118" r="6" stroke="#1a1a1a" strokeWidth="1.5" fill="none"/>
          <circle cx="75" cy="108" r="5" stroke="#1a1a1a" strokeWidth="1.5" fill="none"/>
          <circle cx="52" cy="125" r="5" stroke="#1a1a1a" strokeWidth="1.5" fill="none"/>
          <path d="M40 75 Q60 68 80 75" stroke="#1a1a1a" strokeWidth="1" strokeLinecap="round" fill="none"/>
        </svg>
        <p style={{ fontFamily: "'Caveat', cursive", fontSize: 13, color: "#bbb", letterSpacing: "0.05em", textTransform: "uppercase", border: "1px dashed #ddd", padding: "2px 10px", borderRadius: 2 }}>
          your feed is empty
        </p>
      </div>

      {/* Quick actions */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {[
          { label: "log a drink", sub: "track today's sip", href: "/log", icon: "✦" },
          { label: "explore spots", sub: "find new places", href: "/explore", icon: "◎" },
          { label: "friends' picks", sub: "see what they loved", href: "/friends", icon: "♡" },
          { label: "your profile", sub: "reviews + stats", href: "/profile", icon: "◯" },
        ].map(({ label, sub, href, icon }) => (
          <Link key={label} href={href} style={{ textDecoration: "none" }}>
            <div className="card-hover" style={{
              background: "white",
              border: "1px solid #e8e8e4",
              borderRadius: 12,
              padding: "18px 16px",
              cursor: "pointer",
            }}>
              <div style={{ fontSize: 18, marginBottom: 8, color: "#2d6a4f" }}>{icon}</div>
              <div style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 15, color: "#1a1a1a", marginBottom: 4 }}>{label}</div>
              <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: "#888" }}>{sub}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
