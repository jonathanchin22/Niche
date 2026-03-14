"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { getCurrentUser, joinApp } from "@niche/auth/client"
import type { User } from "@niche/shared-types"

export default function JoinPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [joining, setJoining] = useState(false)

  useEffect(() => {
    getCurrentUser().then(setUser)
  }, [])

  async function handleJoin() {
    setJoining(true)
    try {
      await joinApp("boba")
      router.push("/")
    } catch (e) {
      console.error(e)
      setJoining(false)
    }
  }

  if (!user) return null

  // Find which app(s) they already have
  const existingApps = user.app_memberships?.map((m) => m.app_id) ?? []
  const fromApp = existingApps.find((a) => a !== "boba") ?? existingApps[0]

  return (
    <div className="min-h-screen bg-gradient-to-b from-boba-soft to-white flex flex-col items-center justify-center p-6">
      <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-boba-accent to-purple-800 flex items-center justify-center text-4xl shadow-xl shadow-boba-accent/30 mb-6">
        🧋
      </div>

      <h1 className="text-3xl font-black text-boba-text mb-2">boba!</h1>
      <p className="text-sm text-boba-tertiary mb-8">bubble tea, ranked by fans</p>

      <div className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-xl">
        <p className="text-sm text-boba-secondary text-center mb-4 font-semibold">
          You already have an account 👋
        </p>

        {/* The key UX moment — one tap to join */}
        <div className="flex items-center gap-3 bg-boba-soft border-2 border-boba-mid rounded-2xl p-4 mb-4">
          {user.avatar_url ? (
            <img src={user.avatar_url} alt="" className="w-11 h-11 rounded-full" />
          ) : (
            <div className="w-11 h-11 rounded-full bg-gradient-to-br from-boba-accent to-purple-800 flex items-center justify-center text-white font-black text-lg">
              {user.display_name[0]?.toUpperCase()}
            </div>
          )}
          <div className="flex-1">
            <p className="text-sm font-bold text-boba-text">{user.display_name}</p>
            <p className="text-xs text-boba-secondary">@{user.username} · joined via {fromApp}</p>
          </div>
          <div className="w-6 h-6 rounded-full bg-boba-accent flex items-center justify-center text-white text-xs">
            ✓
          </div>
        </div>

        <button
          onClick={handleJoin}
          disabled={joining}
          className="w-full bg-boba-accent text-white font-bold rounded-xl py-4 text-sm shadow-lg shadow-boba-accent/40 disabled:opacity-60"
        >
          {joining ? "Joining…" : "Continue as " + user.display_name.split(" ")[0] + " →"}
        </button>

        <p className="text-center text-xs text-boba-tertiary mt-4">
          Your friends from other apps are already here 🎉
        </p>
      </div>
    </div>
  )
}
