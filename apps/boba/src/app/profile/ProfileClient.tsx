"use client"

import { AppShell } from "@/components/ui/AppShell"
import { createClient } from "@niche/auth/client"
import { useRouter } from "next/navigation"
import Link from "next/link"

interface ProfileClientProps {
  userId: string
  profile: any
  reviews: any[]
}

function StarRow({ score }: { score: number }) {
  const scoreNum = Number(score)
  const pct = Number.isFinite(scoreNum) ? Math.max(0, Math.min(1, scoreNum / 10)) : 0
  return (
    <div style={{ display: "flex", gap: 2 }}>
      {[0, 1, 2, 3, 4].map(i => {
        const fill = Number.isFinite(pct) ? Math.max(0, Math.min(1, pct * 5 - i)) : 0
        const offset = `${Math.max(0, Math.min(100, fill * 100))}%`
        const gid = `sr-pc-${i}-${Math.round(scoreNum * 10)}`
        return (
          <svg key={i} width="13" height="13" viewBox="0 0 24 24">
            <defs><linearGradient id={gid}><stop offset={offset} stopColor="#c9a84c" /><stop offset={offset} stopColor="#e8e8e4" /></linearGradient></defs>
            <path d="M12 2l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17l-5.9 3 1.2-6.5L2.5 9l6.6-.9z" fill={`url(#${gid})`} />
          </svg>
        )
      })}
    </div>
  )
}

function ProfileSketch() {
  return (
    <svg width="60" height="60" viewBox="0 0 100 100" fill="none">
      <circle cx="50" cy="45" r="28" stroke="#2d6a4f" strokeWidth="1.5" fill="none"/>
      <circle cx="42" cy="40" r="2" fill="#2d6a4f"/>
      <circle cx="58" cy="40" r="2" fill="#2d6a4f"/>
      <path d="M42 52 Q50 58 58 52" stroke="#2d6a4f" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
      <path d="M22 38 Q25 15 50 17 Q75 15 78 38" stroke="#2d6a4f" strokeWidth="1.5" fill="none"/>
      <path d="M68 65 L74 80 L62 80 Z" stroke="#2d6a4f" strokeWidth="1.2" fill="none" strokeLinecap="round"/>
      <line x1="68" y1="65" x2="68" y2="58" stroke="#2d6a4f" strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
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

export function ProfileClient({ userId, profile, reviews }: ProfileClientProps) {
  const supabase = createClient()
  const router = useRouter()
  const name = profile?.display_name ?? profile?.username ?? "you"
  const handle = profile?.username ?? ""

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push("/auth/login")
  }

  const safeReviews = Array.isArray(reviews) ? reviews : []
  const uniquePlaces = new Set(safeReviews.map((r: any) => r.place_id)).size

  return (
    <AppShell activeTab="profile">
      <div style={{ padding: "52px 28px 20px", fontFamily: "'DM Sans', sans-serif" }}>

        {/* Profile header */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 20, marginBottom: 32 }}>
          <div style={{
            width: 72, height: 72,
            border: "1.5px solid #e8e8e4",
            borderRadius: "50%",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
            background: "#e8f4ee",
          }}>
            <ProfileSketch />
          </div>
          <div style={{ paddingTop: 8, flex: 1 }}>
            <h2 style={{
              fontFamily: "'DM Serif Display', Georgia, serif",
              fontSize: 22, margin: "0 0 4px", fontWeight: 400, color: "#1a1a1a",
            }}>
              {name}
            </h2>
            {handle && (
              <p style={{ fontFamily: "'Caveat', cursive", fontSize: 14, color: "#888", margin: 0 }}>
                @{handle}
              </p>
            )}
          </div>
          <button
            onClick={handleSignOut}
            style={{
              fontFamily: "'DM Sans', sans-serif", fontSize: 12,
              background: "none", border: "1px solid #e8e8e4",
              borderRadius: 6, padding: "6px 14px", cursor: "pointer", color: "#888",
            }}
          >
            sign out
          </button>
        </div>

        {/* Stats */}
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(3, 1fr)",
          border: "1px solid #e8e8e4", borderRadius: 12, overflow: "hidden",
          marginBottom: 36,
        }}>
          {[
            { label: "drinks", value: safeReviews.length },
            { label: "shops", value: uniquePlaces },
            { label: "reviews", value: safeReviews.length },
          ].map(({ label, value }, i) => (
            <div key={label} style={{
              padding: "16px 12px",
              textAlign: "center",
              borderRight: i < 2 ? "1px solid #e8e8e4" : "none",
            }}>
              <p style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 24, margin: "0 0 2px", color: "#1a1a1a" }}>
                {value}
              </p>
              <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: "#888", margin: 0, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                {label}
              </p>
            </div>
          ))}
        </div>

        {/* Reviews */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <p style={{ fontFamily: "'Caveat', cursive", fontSize: 18, color: "#1a1a1a", margin: 0 }}>
            recent reviews
          </p>
          <Link href="/my-reviews" style={{ textDecoration: "none" }}>
            <span style={{
              fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "#2d6a4f",
              border: "1px solid #2d6a4f", borderRadius: 20, padding: "4px 12px",
            }}>
              all reviews →
            </span>
          </Link>
        </div>

        {safeReviews.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 0" }}>
            <p style={{ fontFamily: "'Caveat', cursive", fontSize: 16, color: "#bbb" }}>
              no reviews yet — go log a drink!
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {reviews.slice(0, 20).map((r: any) => (
              <div key={r.id} style={{
                background: "white", border: "1px solid #e8e8e4",
                borderRadius: 12, padding: "16px 18px",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                  <div>
                    <p style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 16, margin: "0 0 2px", color: "#1a1a1a" }}>
                      {r.item_name ?? "drink"}
                    </p>
                    <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "#888", margin: 0 }}>
                      {r.place?.name ?? "unknown shop"} · <span suppressHydrationWarning>{timeAgo(r.created_at)}</span>
                    </p>
                  </div>
                  <StarRow score={r.score} />
                </div>
                {r.body && (
                  <p style={{ fontFamily: "'Caveat', cursive", fontSize: 15, color: "#555", margin: 0, lineHeight: 1.4 }}>
                    {r.body}
                  </p>
                )}
                {r.tags?.length > 0 && (
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
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
            ))}
          </div>
        )}
      </div>
    </AppShell>
  )
}
