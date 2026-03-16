"use client"

import { useState, useCallback, useRef } from "react"
import { useMutation, useQuery, useQueryClient, useInfiniteQuery } from "@tanstack/react-query"
import { createClient } from "@niche/auth/client"
import { searchUsers, followUser, unfollowUser, getFollowing, getFriendFeed } from "@niche/database"
import { AppShell } from "@/components/ui/AppShell"
import { ReviewCard } from "@/components/feed/ReviewCard"
import { useRouter } from "next/navigation"
import { ReviewModal } from "@/components/review/ReviewModal"

interface FriendsClientProps {
  userId: string
}

type Tab = "friends" | "feed" | "photos"

function EmptySketch() {
  return (
    <svg width="160" height="130" viewBox="0 0 160 130" fill="none">
      <circle cx="80" cy="50" r="12" stroke="#1a1a1a" strokeWidth="1.5" fill="none"/>
      <line x1="80" y1="62" x2="80" y2="90" stroke="#1a1a1a" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M65 72 L80 68 L95 72" stroke="#1a1a1a" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
      <path d="M80 90 L73 108" stroke="#1a1a1a" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M80 90 L87 108" stroke="#1a1a1a" strokeWidth="1.5" strokeLinecap="round"/>
      <rect x="60" y="20" width="16" height="12" rx="2" stroke="#1a1a1a" strokeWidth="1.2" fill="none"/>
      <line x1="68" y1="32" x2="68" y2="38" stroke="#1a1a1a" strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  )
}

export function FriendsClient({ userId }: FriendsClientProps) {
  const supabase = createClient()
  const router = useRouter()
  const queryClient = useQueryClient()
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [tab, setTab] = useState<Tab>("friends")
  const [selectedReview, setSelectedReview] = useState<any | null>(null)
  const searchTimeout = useRef<ReturnType<typeof setTimeout>>()

  const { data: following = [] } = useQuery({
    queryKey: ["following", userId],
    queryFn: () => getFollowing(supabase as any, userId),
  })

  const followingIds = new Set((following as any[]).map((f: any) => f.following_id ?? f.id))

  const { mutate: toggleFollow } = useMutation({
    mutationFn: async (targetId: string) => {
      if (followingIds.has(targetId)) {
        await unfollowUser(supabase as any, { follower_id: userId, following_id: targetId })
      } else {
        await followUser(supabase as any, { follower_id: userId, following_id: targetId })
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["following", userId] })
    },
  })

  const { data: feedData, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading: feedLoading } = useInfiniteQuery({
    queryKey: ["feed", "boba", userId],
    queryFn: ({ pageParam }) =>
      getFriendFeed(supabase as any, {
        user_id: userId,
        app_id: "boba",
        cursor: pageParam as string | undefined,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.cursor ?? undefined,
    enabled: tab === "feed" || tab === "photos",
  })

  const reviews = feedData?.pages.flatMap(p => p.data.map((item: any) => item.review).filter(Boolean)) ?? []
  const withPhotos = reviews.filter(r => r?.image_urls?.length > 0)

  const handleSearch = useCallback((q: string) => {
    setSearchQuery(q)
    clearTimeout(searchTimeout.current)
    if (q.length < 2) { setSearchResults([]); return }
    setIsSearching(true)
    searchTimeout.current = setTimeout(async () => {
      const results = await searchUsers(supabase as any, { query: q, current_user_id: userId })
      setSearchResults(results as any[])
      setIsSearching(false)
    }, 300)
  }, [supabase, userId])

  const displayList = searchQuery.length > 1 ? searchResults : (following as any[])

  return (
    <AppShell activeTab="friends-list">
      <div style={{ padding: "52px 28px 20px", fontFamily: "'DM Sans', sans-serif" }}>

        <button
          type="button"
          onClick={() => router.back()}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            background: "none",
            border: "1px solid #e8e8e4",
            borderRadius: 999,
            padding: "6px 12px",
            marginBottom: 14,
            cursor: "pointer",
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 11,
            color: "#888",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
          }}
          aria-label="Go back"
        >
          ← back
        </button>

        {/* Header */}
        <p style={{ fontFamily: "var(--font-hand)", fontSize: 15, color: "#888", margin: "0 0 4px" }}>
          what they've been sipping
        </p>
        <h1 style={{
          fontFamily: "'DM Serif Display', Georgia, serif",
          fontSize: 30, color: "#1a1a1a",
          margin: "0 0 24px", fontWeight: 400,
        }}>
          friends
        </h1>

        {/* Search */}
        <div style={{
          display: "flex", alignItems: "center",
          border: "1px solid #e8e8e4", borderRadius: 10,
          padding: "10px 14px", background: "white", gap: 8, marginBottom: 24,
        }}>
          <span style={{ color: "#bbb", fontSize: 14 }}>◎</span>
          <input
            value={searchQuery}
            onChange={e => handleSearch(e.target.value)}
            placeholder="find people by username..."
            style={{
              flex: 1, border: "none", outline: "none", background: "transparent",
              fontFamily: "'DM Serif Display', Georgia, serif",
              fontSize: 16, color: "#1a1a1a",
            }}
          />
          {isSearching && <span style={{ fontFamily: "var(--font-hand)", fontSize: 13, color: "#bbb" }}>...</span>}
        </div>

        {/* Tabs */}
        <div style={{
          display: "flex",
          borderTop: "1px solid #e8e8e4",
          borderBottom: "1px solid #e8e8e4",
          marginBottom: 20,
        }}>
          {(["friends", "feed", "photos"] as const).map(t => (
            <button key={t} type="button" onClick={() => setTab(t)} style={{
              flex: 1, padding: "12px", background: "none", border: "none",
              borderBottom: `2px solid ${tab === t ? "#2d6a4f" : "transparent"}`,
              fontFamily: "'DM Sans', sans-serif", fontSize: 10,
              color: tab === t ? "#2d6a4f" : "#bbb",
              cursor: "pointer", letterSpacing: "0.08em", textTransform: "uppercase",
              marginBottom: -1,
            }}>
              {t}
            </button>
          ))}
        </div>

        {/* Friends Tab */}
        {tab === "friends" && (
          <>
            {displayList.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {displayList.map((person: any) => {
                  const pid = person.following_id ?? person.id
                  const name = person.profile?.display_name ?? person.display_name ?? person.username ?? "unknown"
                  const handle = person.profile?.username ?? person.username ?? ""
                  const isFollowing = followingIds.has(pid)

                  return (
                    <div
                      key={pid}
                      onClick={() => {
                        if (handle) router.push(`/profile/${handle}`)
                      }}
                      style={{
                        background: "white", border: "1px solid #e8e8e4",
                        borderRadius: 12, padding: "16px 18px",
                        display: "flex", alignItems: "center", gap: 12,
                        cursor: handle ? "pointer" : "default",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0 }}>
                        {handle ? (
                          <>
                            <div style={{
                              width: 40, height: 40, borderRadius: "50%",
                              border: "1.5px solid #e8e8e4", background: "#e8f4ee",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              fontFamily: "'DM Serif Display', Georgia, serif",
                              fontSize: 18, color: "#2d6a4f", flexShrink: 0,
                            }}>
                              {name[0]?.toUpperCase()}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 15, margin: 0, color: "#1a1a1a" }}>
                                {name}
                              </p>
                              <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, margin: 0, color: "#bbb" }}>
                                @{handle}
                              </p>
                            </div>
                          </>
                        ) : (
                          <>
                            <div style={{
                              width: 40, height: 40, borderRadius: "50%",
                              border: "1.5px solid #e8e8e4", background: "#e8f4ee",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              fontFamily: "'DM Serif Display', Georgia, serif",
                              fontSize: 18, color: "#2d6a4f", flexShrink: 0,
                            }}>
                              {name[0]?.toUpperCase()}
                            </div>
                            <div style={{ flex: 1 }}>
                              <p style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 15, margin: 0, color: "#1a1a1a" }}>
                                {name}
                              </p>
                            </div>
                          </>
                        )}
                      </div>
                      {pid !== userId && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            toggleFollow(pid)
                          }}
                          style={{
                            fontFamily: "'DM Sans', sans-serif", fontSize: 12,
                            padding: "6px 16px", borderRadius: 20,
                            border: `1px solid ${isFollowing ? "#e8e8e4" : "#2d6a4f"}`,
                            background: isFollowing ? "transparent" : "#e8f4ee",
                            color: isFollowing ? "#888" : "#2d6a4f",
                            cursor: "pointer",
                          }}
                        >
                          {isFollowing ? "following" : "+ follow"}
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            ) : (
              <div style={{
                padding: "40px 0",
                display: "flex", flexDirection: "column", alignItems: "center", gap: 12,
              }}>
                <EmptySketch />
                <span style={{ fontFamily: "'Courier New', monospace", fontSize: 10, color: "#bbb", letterSpacing: "0.05em", textTransform: "uppercase", border: "1px dashed #ddd", padding: "2px 10px", borderRadius: 2 }}>
                  {searchQuery.length > 1 ? "no one found" : "find boba friends"}
                </span>
                {searchQuery.length < 2 && (
                  <p style={{ fontFamily: "var(--font-hand)", fontSize: 15, color: "#bbb", textAlign: "center", margin: 0 }}>
                    search above to find people
                  </p>
                )}
              </div>
            )}
          </>
        )}

        {/* Feed Tab */}
        {tab === "feed" && (
          <>
            {feedLoading && (
              <div style={{ padding: "40px 0", textAlign: "center" }}>
                <span style={{ fontFamily: "var(--font-hand)", fontSize: 13, color: "#bbb" }}>loading...</span>
              </div>
            )}

            {!feedLoading && reviews.length === 0 && (
              <div style={{ padding: "40px 0", textAlign: "center" }}>
                <p style={{ fontFamily: "var(--font-hand)", fontSize: 16, color: "#bbb", lineHeight: 1.5 }}>
                  Follow friends to see their boba picks here.
                </p>
              </div>
            )}

            {!feedLoading && (
              <div>
                {reviews.map(r => r && (
                  <ReviewCard key={r.id} review={r} currentUserId={userId} onClick={() => setSelectedReview(r)} />
                ))}
                {hasNextPage && (
                  <button
                    onClick={() => fetchNextPage()}
                    disabled={isFetchingNextPage}
                    style={{
                      width: "100%", padding: "16px", marginTop: 16,
                      background: "none", border: "1px solid #e8e8e4",
                      fontFamily: "'DM Sans', sans-serif", fontSize: 10,
                      color: "#bbb", cursor: "pointer",
                      letterSpacing: "0.08em", textTransform: "uppercase",
                    }}
                  >
                    {isFetchingNextPage ? "loading..." : "load more →"}
                  </button>
                )}
              </div>
            )}
          </>
        )}

        {/* Photos Tab */}
        {tab === "photos" && (
          <>
            {feedLoading && (
              <div style={{ padding: "40px 0", textAlign: "center" }}>
                <span style={{ fontFamily: "var(--font-hand)", fontSize: 13, color: "#bbb" }}>loading...</span>
              </div>
            )}

            {!feedLoading && withPhotos.length === 0 && (
              <div style={{ padding: "16px 0" }}>
                <p style={{ fontFamily: "var(--font-hand)", fontSize: 15, color: "#bbb" }}>
                  No photos from friends yet.
                </p>
              </div>
            )}

            {!feedLoading && (
              <div style={{ padding: "16px 0" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                  {withPhotos.map(r => r && (
                    <div
                      key={r.id}
                      onClick={() => setSelectedReview(r)}
                      style={{ height: 150, borderRadius: 4, overflow: "hidden", background: "#f0f0ec", position: "relative", cursor: "pointer" }}
                    >
                      <img src={r.image_urls[0]} alt={r.item_name ?? ""} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      <div style={{
                        position: "absolute", bottom: 0, left: 0, right: 0,
                        background: "linear-gradient(transparent, rgba(26,26,26,0.65))",
                        padding: "8px",
                      }}>
                        <p style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 11, color: "#fff", margin: 0 }}>
                          {r.item_name}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {selectedReview && (
          <ReviewModal
            review={selectedReview}
            currentUserId={userId}
            onClose={() => setSelectedReview(null)}
          />
        )}
      </div>
    </AppShell>
  )
}
