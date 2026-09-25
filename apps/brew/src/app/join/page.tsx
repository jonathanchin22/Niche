"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { getCurrentUser, joinApp } from "@niche/auth/client"
import type { User } from "@niche/shared-types"
import { Avatar } from "@/components/ui/Primitives"
import { SteamingCup } from "@/components/ui/Doodles"

/** One-tap join for people who already have a niche account from another app. */
export default function JoinPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getCurrentUser().then(setUser)
  }, [])

  async function handleJoin() {
    setJoining(true)
    setError(null)
    try {
      await joinApp("brew")
      router.push("/")
      router.refresh()
    } catch {
      setError("Couldn't join just now — try again.")
      setJoining(false)
    }
  }

  const fromApp = user?.app_memberships?.map(m => m.app_id).find(a => a !== "brew")

  return (
    <div style={{ minHeight: "100svh", maxWidth: 430, margin: "0 auto", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 18, padding: "40px 24px", textAlign: "center" }}>
      <SteamingCup size={130} animated={!user} />
      <span className="t-display" style={{ fontStyle: "italic", fontSize: 64, lineHeight: 0.85 }}>brew.</span>
      <p className="t-hand" style={{ fontSize: 22, color: "var(--c-mid)" }}>every cup, remembered</p>

      {user && (
        <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 12, marginTop: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: 14, background: "var(--c-paper)", border: "1px solid var(--c-rule)", borderRadius: 2, textAlign: "left" }}>
            <Avatar user={user} size={44} />
            <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span style={{ fontSize: 15, fontWeight: 500 }}>{user.display_name}</span>
              <span style={{ fontSize: 12, color: "var(--c-mid)" }}>@{user.username}{fromApp ? ` · from ${fromApp}` : ""}</span>
            </span>
          </div>
          <button type="button" onClick={handleJoin} disabled={joining} className="btn btn-primary">
            {joining ? "joining…" : `continue as ${user.display_name?.split(" ")[0] ?? user.username}`}
          </button>
          <p className="t-meta" style={{ fontSize: 12 }}>Same account, same friends — your follows carry over.</p>
          {error && <p role="alert" className="t-meta">{error}</p>}
        </div>
      )}
    </div>
  )
}
