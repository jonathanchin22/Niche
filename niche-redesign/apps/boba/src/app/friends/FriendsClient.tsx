"use client"

import { useState, useCallback, useRef } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@niche/auth/client"
import { searchUsers, followUser, unfollowUser, getFollowing, getFriendPhotoFeed } from "@niche/database"
import { AppShell } from "@/components/ui/AppShell"
import { ReviewModal } from "@/components/review/ReviewModal"

interface FriendsClientProps {
  userId: string
}

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
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<"friends" | "photos">("friends")
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [selectedReview, setSelectedReview] = useState<any | null>(null)
  const searchTimeout = useRef<ReturnType<typeof setTimeout>>()

  const { data: following = [] } = useQuery({
    queryKey: ["following", userId],
    queryFn: () => getFollowing(supabase as any, userId),
  })

  const { data: photoFeed = [], isLoading: photosLoading } = useQuery({
    queryKey: ["friendPhotos", userId],
    queryFn: () => getFriendPhotoFeed(supabase as any, { user_id: userId, app_id: "boba" }),
    enabled: tab === "photos",
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
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["following", userId] }),
  })

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

  // Flatten photo feed: each review may have multiple images
  const allPhotos = (photoFeed as any[]).flatMap((r: any) =>
    (r.image_urls ?? []).map((url: string) => ({ url, review: r }))
  )

  return (
    <AppShell activeTab="friends-list">
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Caveat:wght@400;600&family=DM+Serif+Display:ital@0;1&family=DM+Sans:wght@300;400;500&display=swap');`}</style>
      <div style={{ padding: "52px 28px 20px", fontFamily: "'DM Sans', sans-serif" }}>

        {/* Header */}
        <p style={{ fontFamily: "'Caveat', cursive", fontSize: 15, color: "#888", margin: "0 0 4px" }}>
          what they've been sipping
        </p>
        <h1 style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 30, color: "#1a1a1a", margin: "0 0 20px", fontWeight: 400 }}>
          friends
        </h1>

        {/* Tab switcher */}
        <div style={{ display: "flex", borderBottom: "1px solid #e8e8e4", marginBottom: 20 }}>
          {(["friends", "photos"] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                flex: 1, fontFamily: "'DM Sans', sans-serif", fontSize: 13,
                padding: "10px 0", background: "none", border: "none",
                borderBottom: `2px solid ${tab === t ? "#2d6a4f" : "transparent"}`,
                color: tab === t ? "#2d6a4f" : "#888", cursor: "pointer",
                marginBottom: -1, textTransform: "uppercase", letterSpacing: "0.06em",
              }}
            >{t}</button>
          ))}
        </div>

        {/* ── Friends tab ─────────────────────────────────────────────────── */}
        {tab === "friends" && (
          <>
            {/* Search */}
            <div style={{
              display: "flex", alignItems: "center",
              border: "1px solid #e8e8e4", borderRadius: 10,
              padding: "10px 14px", background: "white", gap: 8, marginBottom: 20,
            }}>
              <span style={{ color: "#bbb", fontSize: 14 }}>◎</span>
              <input
                value={searchQuery}
                onChange={e => handleSearch(e.target.value)}
                placeholder="find people by username..."
                style={{
                  flex: 1, border: "none", outline: "none", background: "transparent",
                  fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 16, color: "#1a1a1a",
                }}
              />
              {isSearching && <span style={{ fontFamily: "'Caveat', cursive", fontSize: 13, color: "#bbb" }}>...</span>}
            </div>

            {displayList.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {displayList.map((person: any) => {
                  const pid = person.following_id ?? person.id
                  const name = person.profile?.display_name ?? person.display_name ?? person.username ?? "unknown"
                  const handle = person.profile?.username ?? person.username ?? ""
                  const isFollowing = followingIds.has(pid)
                  return (
                    <div key={pid} style={{
                      background: "white", border: "1px solid #e8e8e4",
                      borderRadius: 12, padding: "14px 16px",
                      display: "flex", alignItems: "center", gap: 12,
                    }}>
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
                        <p style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 15, margin: 0, color: "#1a1a1a" }}>{name}</p>
                        {handle && <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, margin: 0, color: "#bbb" }}>@{handle}</p>}
                      </div>
                      {pid !== userId && (
                        <button
                          onClick={() => toggleFollow(pid)}
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
              <div style={{ padding: "40px 0", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
                <EmptySketch />
                <span style={{ fontFamily: "'Courier New', monospace", fontSize: 10, color: "#bbb", letterSpacing: "0.05em", textTransform: "uppercase", border: "1px dashed #ddd", padding: "2px 10px", borderRadius: 2 }}>
                  {searchQuery.length > 1 ? "no one found" : "find boba friends"}
                </span>
                {searchQuery.length < 2 && (
                  <p style={{ fontFamily: "'Caveat', cursive", fontSize: 15, color: "#bbb", textAlign: "center", margin: 0 }}>
                    search above to find people
                  </p>
                )}
              </div>
            )}
          </>
        )}

        {/* ── Photos tab ──────────────────────────────────────────────────── */}
        {tab === "photos" && (
          <>
            {photosLoading ? (
              <div style={{ padding: "40px 0", textAlign: "center" }}>
                <p style={{ fontFamily: "'Caveat', cursive", fontSize: 16, color: "#bbb" }}>loading...</p>
              </div>
            ) : allPhotos.length === 0 ? (
              <div style={{ padding: "40px 0", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
                <EmptySketch />
                <p style={{ fontFamily: "'Caveat', cursive", fontSize: 15, color: "#bbb", textAlign: "center" }}>
                  {(following as any[]).length === 0
                    ? "follow friends to see their photos"
                    : "your friends haven't added photos yet"}
                </p>
              </div>
            ) : (
              <>
                <p style={{ fontFamily: "'Caveat', cursive", fontSize: 14, color: "#888", margin: "0 0 12px" }}>
                  {allPhotos.length} photo{allPhotos.length !== 1 ? "s" : ""} from friends
                </p>
                {/* 3-col collage */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 3, borderRadius: 4, overflow: "hidden", margin: "0 -28px" }}>
                  {allPhotos.map(({ url, review: r }, i) => {
                    const posterName = r.profile?.display_name ?? r.profile?.username ?? "?"
                    return (
                      <div
                        key={`${r.id}-${i}`}
                        onClick={() => setSelectedReview(r)}
                        style={{ position: "relative", aspectRatio: "1/1", cursor: "pointer" }}
                      >
                        <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                        <div style={{
                          position: "absolute", bottom: 0, left: 0, right: 0,
                          background: "linear-gradient(to top, rgba(0,0,0,0.5) 0%, transparent 60%)",
                          padding: "12px 6px 4px",
                        }}>
                          <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 9, color: "#fff", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {posterName}
                          </p>
                          <p style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 11, color: "#fff", margin: 0 }}>
                            {r.score?.toFixed(1)}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* Review modal */}
      {selectedReview && (
        <ReviewModal
          review={selectedReview}
          currentUserId={userId}
          onClose={() => setSelectedReview(null)}
        />
      )}
    </AppShell>
  )
}
