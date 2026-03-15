"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { getCurrentUser, joinApp } from "@niche/auth/client"
import type { User } from "@niche/shared-types"
import { BobaSketch } from "@/components/illustrations/BobaSketch"

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
    <div style={{
      minHeight: "100vh",
      background: "#fafaf8",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "32px 20px",
      maxWidth: 430,
      margin: "0 auto",
    }}>
      {/* App header */}
      <div style={{ textAlign: "center", marginBottom: 36 }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
          <BobaSketch />
        </div>
        <h1 style={{
          fontFamily: "'DM Serif Display', Georgia, serif",
          fontSize: 38, color: "#1a1a1a",
          margin: "0 0 6px", fontWeight: 400, lineHeight: 1,
        }}>
          boba!
        </h1>
        <p style={{
          fontFamily: "'Caveat', cursive",
          fontSize: 16, color: "#888", margin: 0,
        }}>
          bubble tea, ranked by fans
        </p>
      </div>

      {/* Card */}
      <div style={{
        width: "100%",
        background: "white",
        border: "1px solid #e8e8e4",
        borderRadius: 12,
        padding: "28px 24px",
      }}>
        <p style={{
          fontFamily: "'DM Sans', system-ui, sans-serif",
          fontSize: 13, color: "#888",
          textAlign: "center", margin: "0 0 20px",
        }}>
          You already have an account 👋
        </p>

        {/* User identity row */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          background: "#f5f5f3",
          border: "1px solid #e8e8e4",
          borderRadius: 10,
          padding: "14px 16px",
          marginBottom: 20,
        }}>
          {user.avatar_url ? (
            <img src={user.avatar_url} alt="" style={{ width: 44, height: 44, borderRadius: "50%", flexShrink: 0 }} />
          ) : (
            <div style={{
              width: 44, height: 44, borderRadius: "50%",
              background: "#e8f4ee", border: "1px solid #c8e6d4",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#2d6a4f", fontFamily: "'DM Serif Display', Georgia, serif",
              fontSize: 20, fontWeight: 400, flexShrink: 0,
            }}>
              {user.display_name[0]?.toUpperCase()}
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{
              fontFamily: "'DM Serif Display', Georgia, serif",
              fontSize: 16, color: "#1a1a1a", margin: "0 0 2px", fontWeight: 400,
            }}>
              {user.display_name}
            </p>
            <p style={{
              fontFamily: "'DM Sans', system-ui, sans-serif",
              fontSize: 12, color: "#888", margin: 0,
            }}>
              @{user.username} · joined via {fromApp}
            </p>
          </div>
          <span style={{ color: "#2d6a4f", fontSize: 16 }}>✓</span>
        </div>

        <button
          onClick={handleJoin}
          disabled={joining}
          style={{
            width: "100%",
            background: "#2d6a4f",
            color: "white",
            fontFamily: "'DM Sans', system-ui, sans-serif",
            fontWeight: 600,
            fontSize: 14,
            padding: "13px 0",
            borderRadius: 8,
            border: "none",
            cursor: joining ? "not-allowed" : "pointer",
            opacity: joining ? 0.6 : 1,
          }}
        >
          {joining ? "Joining…" : "Continue as " + user.display_name.split(" ")[0] + " →"}
        </button>

        <p style={{
          fontFamily: "'Caveat', cursive",
          fontSize: 15, color: "#bbb",
          textAlign: "center", margin: "16px 0 0",
        }}>
          Your friends from other apps are already here 🎉
        </p>
      </div>
    </div>
  )
}
