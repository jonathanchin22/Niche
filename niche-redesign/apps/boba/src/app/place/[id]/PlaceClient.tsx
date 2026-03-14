"use client"

import { AppShell } from "@/components/ui/AppShell"
import Link from "next/link"

interface PlaceClientProps {
  place: any
  reviews: any[]
}

function StarRow({ score }: { score: number }) {
  const pct = score / 10
  return (
    <div style={{ display: "flex", gap: 2 }}>
      {[0, 1, 2, 3, 4].map(i => {
        const fill = Math.max(0, Math.min(1, pct * 5 - i))
        const gid = `sr-pl-${i}-${Math.round(score * 10)}`
        return (
          <svg key={i} width="13" height="13" viewBox="0 0 24 24">
            <defs><linearGradient id={gid}><stop offset={`${fill * 100}%`} stopColor="#c9a84c" /><stop offset={`${fill * 100}%`} stopColor="#e8e8e4" /></linearGradient></defs>
            <path d="M12 2l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17l-5.9 3 1.2-6.5L2.5 9l6.6-.9z" fill={`url(#${gid})`} />
          </svg>
        )
      })}
    </div>
  )
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return "today"
  if (days === 1) return "yesterday"
  if (days < 7) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

export function PlaceClient({ place, reviews }: PlaceClientProps) {
  return (
    <AppShell activeTab="explore">
      <div style={{ padding: "52px 28px 20px", fontFamily: "'DM Sans', sans-serif" }}>

        {/* Back */}
        <Link href="/explore" style={{ textDecoration: "none" }}>
          <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "#888", margin: "0 0 24px" }}>
            ← explore
          </p>
        </Link>

        {/* Place header */}
        <div style={{ marginBottom: 28 }}>
          <p style={{ fontFamily: "'Caveat', cursive", fontSize: 14, color: "#888", margin: "0 0 4px" }}>
            {place.city ?? ""}{place.city && place.state ? ", " : ""}{place.state ?? ""}
          </p>
          <h1 style={{
            fontFamily: "'DM Serif Display', Georgia, serif",
            fontSize: 30, color: "#1a1a1a",
            margin: "0 0 8px", fontWeight: 400, lineHeight: 1.1,
          }}>
            {place.name}
          </h1>
          <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "#888", margin: "0 0 16px" }}>
            {place.address}
          </p>

          {/* Stats row */}
          <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
            {place.avg_score && (
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 22, color: "#1a1a1a" }}>
                  {(place.avg_score / 2).toFixed(1)}
                </span>
                <StarRow score={place.avg_score} />
              </div>
            )}
            <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "#bbb" }}>
              {place.review_count ?? reviews.length} reviews
            </span>
          </div>
        </div>

        {/* Log CTA */}
        <Link href="/log">
          <button style={{
            width: "100%", background: "#2d6a4f", color: "#fff",
            border: "none", borderRadius: 10, padding: "14px",
            fontFamily: "'DM Sans', sans-serif", fontSize: 15,
            cursor: "pointer", marginBottom: 32,
          }}>
            log a drink here
          </button>
        </Link>

        {/* Reviews */}
        <p style={{ fontFamily: "'Caveat', cursive", fontSize: 18, color: "#1a1a1a", margin: "0 0 16px" }}>
          {reviews.length > 0 ? `${reviews.length} review${reviews.length !== 1 ? "s" : ""}` : "no reviews yet"}
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {reviews.map((r: any) => {
            const name = r.profile?.display_name ?? r.profile?.username ?? "someone"
            return (
              <div key={r.id} style={{
                background: "white", border: "1px solid #e8e8e4",
                borderRadius: 12, padding: "16px 18px",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: "50%",
                    background: "#e8f4ee", border: "1.5px solid #e8e8e4",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontFamily: "'DM Serif Display', Georgia, serif",
                    fontSize: 14, color: "#2d6a4f", flexShrink: 0,
                  }}>
                    {name[0]?.toUpperCase()}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 14, margin: 0, color: "#1a1a1a" }}>
                      {name}
                    </p>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2 }}>
                      <StarRow score={r.score} />
                      <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: "#bbb" }}>
                        {timeAgo(r.created_at)}
                      </span>
                    </div>
                  </div>
                </div>
                {r.body && (
                  <p style={{
                    fontFamily: "'Caveat', cursive", fontSize: 16, color: "#333",
                    margin: "0 0 8px", lineHeight: 1.5,
                    borderLeft: "2px solid #e8f4ee", paddingLeft: 10,
                  }}>
                    {r.body}
                  </p>
                )}
                {r.tags?.length > 0 && (
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {r.tags.map((t: string) => (
                      <span key={t} style={{
                        fontFamily: "'DM Sans', sans-serif", fontSize: 11,
                        background: "#e8f4ee", color: "#2d6a4f",
                        padding: "2px 8px", borderRadius: 10,
                      }}>{t}</span>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </AppShell>
  )
}
