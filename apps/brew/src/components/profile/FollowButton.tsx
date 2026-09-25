"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@niche/auth/client"
import { followUser, unfollowUser } from "@niche/database"

export default function FollowButton({ viewerId, targetId, initialFollowing, size = "md" }: {
  viewerId: string
  targetId: string
  initialFollowing: boolean
  size?: "md" | "sm"
}) {
  const router = useRouter()
  const [following, setFollowing] = useState(initialFollowing)
  const [busy, setBusy] = useState(false)

  const toggle = async () => {
    const next = !following
    setFollowing(next)
    setBusy(true)
    try {
      const supabase = createClient()
      if (next) await followUser(supabase, { follower_id: viewerId, following_id: targetId })
      else await unfollowUser(supabase, { follower_id: viewerId, following_id: targetId })
      router.refresh()
    } catch {
      setFollowing(!next)
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      aria-pressed={following}
      className={`btn btn-sm ${following ? "btn-secondary" : "btn-primary"}`}
      style={size === "sm" ? { minWidth: 96 } : { minWidth: 120 }}
    >
      {following ? "following" : "follow"}
    </button>
  )
}
