"use client"

import { useState } from "react"
import Link from "next/link"
import { AppShell } from "@/components/ui/AppShell"

type CollectionTab = "favorites" | "want_to_try"

interface CollectionsClientProps {
  favorites: any[]
  wantToTry: any[]
}

export function CollectionsClient({ favorites, wantToTry }: CollectionsClientProps) {
  const [tab, setTab] = useState<CollectionTab>("favorites")
  const items = tab === "favorites" ? favorites : wantToTry

  return (
    <AppShell>
      <div style={{ padding: "52px 20px 20px" }}>
        <p style={{ fontFamily: "'Caveat', cursive", fontSize: 15, color: "#888", margin: "0 0 4px" }}>
          keep your shortlist
        </p>
        <h1 style={{
          fontFamily: "'DM Serif Display', Georgia, serif",
          fontSize: 30,
          color: "#1a1a1a",
          margin: "0 0 16px",
          fontWeight: 400,
        }}>
          collections
        </h1>

        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          <button
            onClick={() => setTab("favorites")}
            style={{
              border: `1px solid ${tab === "favorites" ? "#2d6a4f" : "#e1e5e0"}`,
              background: tab === "favorites" ? "#eef7f1" : "#fff",
              color: tab === "favorites" ? "#2d6a4f" : "#8b8f8a",
              borderRadius: 999,
              padding: "7px 12px",
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 12,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              cursor: "pointer",
            }}
          >
            favorites
          </button>
          <button
            onClick={() => setTab("want_to_try")}
            style={{
              border: `1px solid ${tab === "want_to_try" ? "#2d6a4f" : "#e1e5e0"}`,
              background: tab === "want_to_try" ? "#eef7f1" : "#fff",
              color: tab === "want_to_try" ? "#2d6a4f" : "#8b8f8a",
              borderRadius: 999,
              padding: "7px 12px",
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 12,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              cursor: "pointer",
            }}
          >
            want to try
          </button>
        </div>

        {items.length === 0 ? (
          <div style={{
            border: "1px dashed #d9ddd8",
            borderRadius: 12,
            padding: "30px 20px",
            background: "#fff",
            textAlign: "center",
          }}>
            <p style={{ margin: "0 0 6px", color: "#8f948f", fontFamily: "'Caveat', cursive", fontSize: 18 }}>
              no places saved yet
            </p>
            <p style={{ margin: 0, color: "#9da29d", fontFamily: "'DM Sans', sans-serif", fontSize: 12 }}>
              save places from the place detail screen.
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {items.map((entry: any) => {
              const place = entry.place
              if (!place) return null
              return (
                <Link
                  key={entry.id}
                  href={`/place/${place.id}`}
                  style={{
                    textDecoration: "none",
                    border: "1px solid #e8e8e4",
                    borderRadius: 12,
                    background: "#fff",
                    padding: "12px 14px",
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 10,
                    alignItems: "center",
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <p style={{ margin: "0 0 2px", color: "#1f2520", fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 18 }}>
                      {place.name}
                    </p>
                    <p style={{ margin: 0, color: "#8c908a", fontFamily: "'DM Sans', sans-serif", fontSize: 12 }}>
                      {[place.city, place.state].filter(Boolean).join(", ") || "unknown location"}
                    </p>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <p style={{ margin: "0 0 2px", color: "#1f2520", fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 18 }}>
                      {place.avg_score ? (Number(place.avg_score) / 2).toFixed(1) : "-"}
                    </p>
                    <p style={{ margin: 0, color: "#8c908a", fontFamily: "'DM Sans', sans-serif", fontSize: 11 }}>
                      {place.review_count ?? 0} reviews
                    </p>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </AppShell>
  )
}
