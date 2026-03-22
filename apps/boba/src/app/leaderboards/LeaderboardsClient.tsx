"use client"

import { useState } from "react"
import Link from "next/link"
import { AppShell } from "@/components/ui/AppShell"

type RankTab = "spots" | "people"

interface LeaderboardsClientProps {
  topPlaces: any[]
  topReviewers: any[]
}

export function LeaderboardsClient({ topPlaces, topReviewers }: LeaderboardsClientProps) {
  const [tab, setTab] = useState<RankTab>("spots")

  return (
    <AppShell>
      <div style={{ padding: "52px 20px 22px" }}>
        <p style={{ fontFamily: "'Caveat', cursive", fontSize: 15, color: "#888", margin: "0 0 4px" }}>
          weekly pulse
        </p>
        <h1 style={{
          fontFamily: "'DM Serif Display', Georgia, serif",
          fontSize: 30,
          color: "#1a1a1a",
          margin: "0 0 16px",
          fontWeight: 400,
        }}>
          leaderboards
        </h1>

        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          {([
            ["spots", "top spots"],
            ["people", "top reviewers"],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              onClick={() => setTab(value)}
              style={{
                border: `1px solid ${tab === value ? "#2d6a4f" : "#e1e5e0"}`,
                background: tab === value ? "#eef7f1" : "#fff",
                color: tab === value ? "#2d6a4f" : "#8b8f8a",
                borderRadius: 999,
                padding: "7px 12px",
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 12,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                cursor: "pointer",
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "spots" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {topPlaces.map((place, index) => (
              <Link
                key={place.id}
                href={`/place/${place.id}`}
                style={{
                  textDecoration: "none",
                  border: "1px solid #e8e8e4",
                  background: "#fff",
                  borderRadius: 12,
                  padding: "12px 14px",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <div style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  border: "1px solid #d7e5dc",
                  background: "#eef7f1",
                  color: "#2d6a4f",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: 12,
                  fontWeight: 700,
                  flexShrink: 0,
                }}>
                  {index + 1}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: "0 0 2px", color: "#1f2520", fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 18 }}>
                    {place.name}
                  </p>
                  <p style={{ margin: 0, color: "#868a84", fontFamily: "'DM Sans', sans-serif", fontSize: 12 }}>
                    {[place.city, place.state].filter(Boolean).join(", ") || "unknown location"}
                  </p>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <p style={{ margin: "0 0 2px", color: "#1f2520", fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 18 }}>
                    {(Number(place.avg_score) / 2).toFixed(1)}
                  </p>
                  <p style={{ margin: 0, color: "#868a84", fontFamily: "'DM Sans', sans-serif", fontSize: 11 }}>
                    {place.review_count} reviews
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}

        {tab === "people" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {topReviewers.map((entry, index) => {
              const user = entry.user || {}
              const name = user.display_name || user.username || "unknown"
              const handle = user.username ? `@${user.username}` : ""

              return (
                <div
                  key={entry.user_id}
                  style={{
                    border: "1px solid #e8e8e4",
                    background: "#fff",
                    borderRadius: 12,
                    padding: "12px 14px",
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <div style={{
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    border: "1px solid #d7e5dc",
                    background: "#eef7f1",
                    color: "#2d6a4f",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: 12,
                    fontWeight: 700,
                    flexShrink: 0,
                  }}>
                    {index + 1}
                  </div>

                  <div style={{
                    width: 34,
                    height: 34,
                    borderRadius: "50%",
                    border: "1px solid #dfe5df",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#2d6a4f",
                    fontFamily: "'DM Serif Display', Georgia, serif",
                    fontSize: 14,
                    background: "#eef7f1",
                    flexShrink: 0,
                  }}>
                    {name.slice(0, 1).toUpperCase()}
                  </div>

                  <div style={{ flex: 1 }}>
                    <p style={{ margin: "0 0 2px", color: "#1f2520", fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 17 }}>
                      {name}
                    </p>
                    <p style={{ margin: 0, color: "#868a84", fontFamily: "'DM Sans', sans-serif", fontSize: 12 }}>
                      {handle || "boba member"}
                    </p>
                  </div>

                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <p style={{ margin: "0 0 2px", color: "#1f2520", fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 18 }}>
                      {entry.xp}
                    </p>
                    <p style={{ margin: 0, color: "#868a84", fontFamily: "'DM Sans', sans-serif", fontSize: 11 }}>
                      xp
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </AppShell>
  )
}
