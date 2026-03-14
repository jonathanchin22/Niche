"use client"

import { useState, useCallback, useRef } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@niche/auth/client"
import { searchUsers, followUser, unfollowUser, getFollowing } from "@niche/database"
import { AppShell } from "@/components/ui/AppShell"

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
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [isSearching, setIsSearching] = useState(false)
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

        {/* Header */}
        <p style={{ fontFamily: "'Caveat', cursive", fontSize: 15, color: "#888", margin: "0 0 4px" }}>
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
          {isSearching && <span style={{ fontFamily: "'Caveat', cursive", fontSize: 13, color: "#bbb" }}>...</span>}
        </div>

        {/* List */}
        {displayList.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {displayList.map((person: any) => {
              const pid = person.following_id ?? person.id
              const name = person.profile?.display_name ?? person.display_name ?? person.username ?? "unknown"
              const handle = person.profile?.username ?? person.username ?? ""
              const isFollowing = followingIds.has(pid)

              return (
                <div key={pid} style={{
                  background: "white", border: "1px solid #e8e8e4",
                  borderRadius: 12, padding: "16px 18px",
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
                    <p style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 15, margin: 0, color: "#1a1a1a" }}>
                      {name}
                    </p>
                    {handle && (
                      <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, margin: 0, color: "#bbb" }}>
                        @{handle}
                      </p>
                    )}
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
          <div style={{
            padding: "40px 0",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 12,
          }}>
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
      </div>
    </AppShell>
  )
}
