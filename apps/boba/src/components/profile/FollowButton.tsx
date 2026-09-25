"use client"

import { track } from "@niche/analytics"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { setFollowing as saveFollowing } from "@/app/actions"

export default function FollowButton({ targetId, initialFollowing, size = "md" }: {
  /** Kept for call sites; the server action uses the session user. */
  viewerId?: string
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
      await saveFollowing(targetId, next)
      track(next ? "friend_followed" : "friend_unfollowed")
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
