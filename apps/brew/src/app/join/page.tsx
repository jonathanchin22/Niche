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
      await joinApp("brew")
      router.push("/")
    } catch (e) {
      console.error(e)
      setJoining(false)
    }
  }

  if (!user) return null

  // Find which app(s) they already have
  const existingApps = user.app_memberships?.map((m) => m.app_id) ?? []
  const fromApp = existingApps.find((a) => a !== "brew") ?? existingApps[0]

  return (
    <div style={{
      minHeight: "100svh",
      background: "var(--c-bg)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "40px 28px",
      maxWidth: 430,
      margin: "0 auto",
    }}>
      {/* Logo */}
      <div style={{ marginBottom: 32, textAlign: "center" }}>
        <div style={{
          width: 80, height: 80, borderRadius: 8,
          border: "2px solid var(--c-accent)", background: "var(--c-accent-bg)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 40, margin: "0 auto 16px",
        }}>
          ☕
        </div>
        <h1 style={{
          fontFamily: "var(--font-display)", fontSize: 36, color: "var(--c-ink)",
          fontWeight: 400, fontStyle: "italic", margin: "0 0 4px",
        }}>
          niche brew
        </h1>
        <p style={{
          fontFamily: "var(--font-hand)", fontSize: 15, color: "var(--c-subtle)",
          margin: 0,
        }}>
          coffee, curated by connoisseurs
        </p>
      </div>

      {/* Join Card */}
      <div style={{
        width: "100%", maxWidth: 320,
        background: "var(--c-bg)", border: "1px solid var(--c-rule)",
        borderRadius: 12, padding: "24px", boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
      }}>
        <p style={{
          fontFamily: "var(--font-display)", fontSize: 16, color: "var(--c-ink)",
          fontStyle: "italic", textAlign: "center", margin: "0 0 20px",
        }}>
          Welcome back! 👋
        </p>

        {/* User Info */}
        <div style={{
          display: "flex", alignItems: "center", gap: 12,
          background: "var(--c-accent-bg)", border: "1px solid var(--c-accent)",
          borderRadius: 8, padding: "16px", marginBottom: 20,
        }}>
          {user.avatar_url ? (
            <img src={user.avatar_url} alt="" style={{
              width: 44, height: 44, borderRadius: 4,
              border: "1.5px solid var(--c-accent)",
            }} />
          ) : (
            <div style={{
              width: 44, height: 44, borderRadius: 4,
              border: "1.5px solid var(--c-accent)", background: "var(--c-accent-bg)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: "var(--font-display)", fontSize: 20, color: "var(--c-accent)",
              fontStyle: "italic", fontWeight: 600,
            }}>
              {user.display_name[0]?.toUpperCase()}
            </div>
          )}
          <div style={{ flex: 1 }}>
            <p style={{
              fontFamily: "var(--font-display)", fontSize: 16, color: "var(--c-ink)",
              fontStyle: "italic", margin: "0 0 2px", fontWeight: 500,
            }}>
              {user.display_name}
            </p>
            <p style={{
              fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--c-subtle)",
              margin: 0, letterSpacing: "0.05em", textTransform: "uppercase",
            }}>
              @{user.username} · joined via {fromApp}
            </p>
          </div>
          <div style={{
            width: 24, height: 24, borderRadius: 2,
            background: "var(--c-accent)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 12, color: "#fff", fontWeight: 600,
          }}>
            ✓
          </div>
        </div>

        <button
          onClick={handleJoin}
          disabled={joining}
          style={{
            width: "100%",
            background: "var(--c-accent)", color: "#fff",
            border: "none", borderRadius: 8,
            padding: "16px", fontFamily: "var(--font-display)",
            fontSize: 16, fontStyle: "italic", fontWeight: 500,
            cursor: joining ? "not-allowed" : "pointer",
            opacity: joining ? 0.6 : 1,
            boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
          }}
        >
          {joining ? "Joining..." : `Continue as ${user.display_name.split(" ")[0]} →`}
        </button>

        <p style={{
          fontFamily: "var(--font-hand)", fontSize: 14, color: "var(--c-subtle)",
          textAlign: "center", margin: "16px 0 0", lineHeight: 1.4,
        }}>
          Your coffee-loving friends are already here! ☕
        </p>
      </div>
    </div>
  )
}