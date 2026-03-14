"use client"

import { useState, useCallback, useRef } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@niche/auth/client"
import { searchUsers, followUser, unfollowUser, getFollowing } from "@niche/database"
import { CupSteamSketch, MonoLabel } from "@/components/ui/Primitives"

interface FriendsClientProps {
  userId: string
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
    <div style={{ padding: "0 28px 20px" }}>
      {/* Search */}
      <div style={{
        display: "flex", alignItems: "center",
        border: "1px solid var(--c-rule)", borderRadius: 8,
        padding: "12px 16px", background: "var(--c-bg)", gap: 8, marginBottom: 24,
      }}>
        <span style={{ color: "var(--c-subtle)", fontSize: 14 }}>◎</span>
        <input
          value={searchQuery}
          onChange={e => handleSearch(e.target.value)}
          placeholder="find people by username..."
          style={{
            flex: 1, border: "none", outline: "none", background: "transparent",
            fontFamily: "var(--font-display)", fontSize: 16, color: "var(--c-ink)",
            fontStyle: "italic",
          }}
        />
        {isSearching && <MonoLabel>...</MonoLabel>}
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
                background: "var(--c-bg)", border: "1px solid var(--c-rule)",
                borderRadius: 8, padding: "16px 18px",
                display: "flex", alignItems: "center", gap: 12,
              }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 4,
                  border: "1.5px solid var(--c-rule)", background: "var(--c-accent-bg)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontFamily: "var(--font-display)", fontSize: 18, color: "var(--c-accent)",
                  fontStyle: "italic", flexShrink: 0,
                }}>
                  {name[0]?.toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontFamily: "var(--font-display)", fontSize: 15, margin: 0, color: "var(--c-ink)", fontStyle: "italic" }}>
                    {name}
                  </p>
                  {handle && (
                    <MonoLabel style={{ marginTop: 2 }}>@{handle}</MonoLabel>
                  )}
                </div>
                {pid !== userId && (
                  <button
                    onClick={() => toggleFollow(pid)}
                    style={{
                      fontFamily: "var(--font-mono)", fontSize: 10,
                      padding: "6px 16px", borderRadius: 20,
                      border: `1px solid ${isFollowing ? "var(--c-rule)" : "var(--c-accent)"}`,
                      background: isFollowing ? "transparent" : "var(--c-accent-bg)",
                      color: isFollowing ? "var(--c-subtle)" : "var(--c-accent)",
                      cursor: "pointer", letterSpacing: "0.08em", textTransform: "uppercase",
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
          <CupSteamSketch />
          <MonoLabel style={{ border: "1px dashed var(--c-rule)", padding: "4px 12px", borderRadius: 4 }}>
            {searchQuery.length > 1 ? "no one found" : "find brew friends"}
          </MonoLabel>
          {searchQuery.length < 2 && (
            <p style={{ fontFamily: "var(--font-hand)", fontSize: 15, color: "var(--c-subtle)", textAlign: "center", margin: 0 }}>
              search above to find people
            </p>
          )}
        </div>
      )}
    </div>
  )
}

export default FriendsClient
