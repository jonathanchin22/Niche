"use client"

import { useState, useCallback, useRef } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@niche/auth"
import { searchUsers, followUser, unfollowUser, getFollowing } from "@niche/database"
import { AppShell } from "@/components/ui/AppShell"

interface UserCardProps {
  user: any
  currentUserId: string
  isFollowing: boolean
  onToggle: () => void
  isLoading: boolean
}

function Avatar({ user, size = 44 }: { user: any; size?: number }) {
  const initials = user?.display_name?.[0] ?? user?.username?.[0] ?? "?"
  if (user?.avatar_url) {
    return <img src={user.avatar_url} alt={initials} className="rounded-full object-cover flex-shrink-0" style={{ width: size, height: size }} />
  }
  return (
    <div className="rounded-full flex items-center justify-center font-bold text-white flex-shrink-0" style={{ width: size, height: size, background: "linear-gradient(135deg, #7C3AED, #9F67FF)", fontSize: size * 0.35 }}>
      {initials.toUpperCase()}
    </div>
  )
}

function UserCard({ user, currentUserId, isFollowing, onToggle, isLoading }: UserCardProps) {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-purple-50 flex items-center gap-3">
      <Avatar user={user} />
      <div className="flex-1 min-w-0">
        <p className="font-bold text-sm" style={{ color: "#12082A" }}>{user.display_name || user.username}</p>
        {user.username && user.display_name && (
          <p className="text-xs" style={{ color: "#6B5B8A" }}>@{user.username}</p>
        )}
      </div>
      <button
        onClick={onToggle}
        disabled={isLoading}
        className="px-4 py-1.5 rounded-full text-xs font-bold transition-all disabled:opacity-60"
        style={isFollowing
          ? { background: "#F3EEFF", color: "#7C3AED", border: "2px solid #7C3AED" }
          : { background: "#7C3AED", color: "white" }
        }
      >
        {isFollowing ? "Following" : "Follow"}
      </button>
    </div>
  )
}

interface FriendsPageClientProps {
  userId: string
}

export default function FriendsPageClient({ userId }: FriendsPageClientProps) {
  const supabase = createClient()
  const queryClient = useQueryClient()
  const [query, setQuery] = useState("")
  const [debouncedQuery, setDebouncedQuery] = useState("")
  const [activeTab, setActiveTab] = useState<"search" | "following">("following")
  const searchTimeout = useRef<ReturnType<typeof setTimeout>>()
  const [pendingFollows, setPendingFollows] = useState<Set<string>>(new Set())

  const handleSearch = useCallback((q: string) => {
    setQuery(q)
    clearTimeout(searchTimeout.current)
    searchTimeout.current = setTimeout(() => {
      setDebouncedQuery(q)
      if (q) setActiveTab("search")
    }, 350)
  }, [])

  const { data: searchResults, isLoading: searchLoading } = useQuery({
    queryKey: ["users", "search", debouncedQuery],
    queryFn: () => searchUsers(supabase as any, { query: debouncedQuery, current_user_id: userId }),
    enabled: debouncedQuery.length > 0,
  })

  const { data: following } = useQuery({
    queryKey: ["following", userId],
    queryFn: () => getFollowing(supabase as any, userId),
  })

  const followingIds = new Set((following ?? []).map((u: any) => u.id))

  const { mutate: toggleFollow } = useMutation({
    mutationFn: async (targetId: string) => {
      setPendingFollows(prev => new Set(prev).add(targetId))
      if (followingIds.has(targetId)) {
        await unfollowUser(supabase as any, { follower_id: userId, following_id: targetId })
      } else {
        await followUser(supabase as any, { follower_id: userId, following_id: targetId })
      }
    },
    onSettled: (_, __, targetId) => {
      setPendingFollows(prev => { const s = new Set(prev); s.delete(targetId); return s })
      queryClient.invalidateQueries({ queryKey: ["following", userId] })
      queryClient.invalidateQueries({ queryKey: ["feed"] })
    },
  })

  const displayUsers = activeTab === "search" ? (searchResults ?? []) : (following ?? [])

  return (
    <AppShell activeTab="friends-list">
      <div className="px-4 pt-4">
        {/* Search */}
        <div className="relative mb-4">
          <svg className="absolute left-3 top-3" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            type="text"
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Find friends..."
            className="w-full pl-10 pr-4 py-2.5 rounded-2xl border-2 text-sm font-medium outline-none transition-colors bg-white"
            style={{ borderColor: "#DDD6FE", color: "#12082A" }}
            onFocus={(e) => (e.target.style.borderColor = "#7C3AED")}
            onBlur={(e) => (e.target.style.borderColor = "#DDD6FE")}
          />
          {searchLoading && (
            <div className="absolute right-3 top-3">
              <div className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "#7C3AED", borderTopColor: "transparent" }} />
            </div>
          )}
        </div>

        {/* Tabs */}
        {!query && (
          <div className="flex gap-2 mb-4">
            {(["following", "search"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className="px-4 py-1.5 rounded-full text-sm font-bold transition-all"
                style={activeTab === tab
                  ? { background: "#7C3AED", color: "white" }
                  : { background: "#F3EEFF", color: "#7C3AED" }
                }
              >
                {tab === "following" ? `Following (${following?.length ?? 0})` : "Find people"}
              </button>
            ))}
          </div>
        )}

        {/* Users list */}
        <div className="flex flex-col gap-3 pb-6">
          {displayUsers.length === 0 && (
            <div className="text-center py-12">
              <span className="text-4xl">👀</span>
              <p className="mt-3 font-bold" style={{ color: "#12082A" }}>
                {activeTab === "following" ? "Not following anyone yet" : "No results found"}
              </p>
              <p className="text-sm mt-1" style={{ color: "#6B5B8A" }}>
                {activeTab === "following" ? "Search for friends above to get started" : "Try a different name"}
              </p>
            </div>
          )}
          {displayUsers.map((user: any) => (
            <UserCard
              key={user.id}
              user={user}
              currentUserId={userId}
              isFollowing={followingIds.has(user.id)}
              isLoading={pendingFollows.has(user.id)}
              onToggle={() => toggleFollow(user.id)}
            />
          ))}
        </div>
      </div>
    </AppShell>
  )
}
