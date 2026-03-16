"use client"

import { useState } from "react"
import { AppShell } from "@/components/ui/AppShell"
import { createClient } from "@niche/auth/client"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ReviewModal } from "@/components/review/ReviewModal"

interface ProfileClientProps {
  userId: string
  profile: any
  reviews: any[]
}

function StarRow({ score }: { score: number }) {
  const pct = score / 10
  return (
    <div style={{ display: "flex", gap: 2 }}>
      {[0, 1, 2, 3, 4].map(i => {
        const fill = Math.max(0, Math.min(1, pct * 5 - i))
        const gid = `sr-pc-${i}-${Math.round(score * 10)}`
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

function ProfileSketch() {
  return (
    <svg width="60" height="60" viewBox="0 0 100 100" fill="none">
      <circle cx="50" cy="45" r="28" stroke="#2d6a4f" strokeWidth="1.5" fill="none"/>
      <circle cx="42" cy="40" r="2" fill="#2d6a4f"/>
      <circle cx="58" cy="40" r="2" fill="#2d6a4f"/>
      <path d="M42 52 Q50 58 58 52" stroke="#2d6a4f" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
      <path d="M22 38 Q25 15 50 17 Q75 15 78 38" stroke="#2d6a4f" strokeWidth="1.5" fill="none"/>
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

export function ProfileClient({ userId, profile, reviews: initialReviews }: ProfileClientProps) {
  const supabase = createClient()
  const router = useRouter()
  const name = profile?.display_name ?? profile?.username ?? "you"
  const handle = profile?.username ?? ""
  const [reviews, setReviews] = useState(initialReviews)
  const [tab, setTab] = useState<"reviews" | "photos">("reviews")
  const [selectedReview, setSelectedReview] = useState<any | null>(null)

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push("/auth/login")
  }

  const uniquePlaces = new Set(reviews.map((r: any) => r.place_id)).size

  // All photos from all reviews, flattened with review reference
  const allPhotos = reviews.flatMap((r: any) =>
    (r.image_urls ?? []).map((url: string) => ({ url, review: r }))
  )

  return (
    <AppShell activeTab="profile">
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Caveat:wght@400;600&family=DM+Serif+Display:ital@0;1&family=DM+Sans:wght@300;400;500&display=swap');`}</style>
      <div style={{ padding: "52px 28px 20px", fontFamily: "'DM Sans', sans-serif" }}>

        {/* Profile header */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 20, marginBottom: 24 }}>
          <div style={{
            width: 72, height: 72, border: "1.5px solid #e8e8e4",
            borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0, background: "#e8f4ee",
          }}>
            <ProfileSketch />
          </div>
          <div style={{ paddingTop: 8, flex: 1 }}>
            <h2 style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 22, margin: "0 0 4px", fontWeight: 400, color: "#1a1a1a" }}>
              {name}
            </h2>
            {handle && (
              <p style={{ fontFamily: "cursive", fontSize: 14, color: "#888", margin: 0 }}>@{handle}</p>
            )}
          </div>
          <button onClick={handleSignOut} style={{
            fontFamily: "'DM Sans', sans-serif", fontSize: 12,
            background: "none", border: "1px solid #e8e8e4",
            borderRadius: 6, padding: "6px 14px", cursor: "pointer", color: "#888",
          }}>sign out</button>
        </div>

        {/* Stats */}
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(3, 1fr)",
          border: "1px solid #e8e8e4", borderRadius: 12, overflow: "hidden", marginBottom: 24,
        }}>
          {[
            { label: "drinks", value: reviews.length },
            { label: "shops", value: uniquePlaces },
            { label: "photos", value: allPhotos.length },
          ].map(({ label, value }, i) => (
            <div key={label} style={{
              padding: "14px 12px", textAlign: "center",
              borderRight: i < 2 ? "1px solid #e8e8e4" : "none",
            }}>
              <p style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 24, margin: "0 0 2px", color: "#1a1a1a" }}>{value}</p>
              <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: "#888", margin: 0, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</p>
            </div>
          ))}
        </div>

        {/* Tab switcher */}
        <div style={{ display: "flex", borderBottom: "1px solid #e8e8e4", marginBottom: 20, gap: 0 }}>
          {(["reviews", "photos"] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                flex: 1, fontFamily: "'DM Sans', sans-serif", fontSize: 13,
                padding: "10px 0", background: "none", border: "none",
                borderBottom: `2px solid ${tab === t ? "#2d6a4f" : "transparent"}`,
                color: tab === t ? "#2d6a4f" : "#888", cursor: "pointer",
                marginBottom: -1, textTransform: "uppercase", letterSpacing: "0.06em",
              }}
            >{t}</button>
          ))}
        </div>

        {/* Reviews tab */}
        {tab === "reviews" && (
          <>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <p style={{ fontFamily: "cursive", fontSize: 18, color: "#1a1a1a", margin: 0 }}>recent reviews</p>
              <Link href="/my-reviews" style={{ textDecoration: "none" }}>
                <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "#2d6a4f", border: "1px solid #2d6a4f", borderRadius: 20, padding: "4px 12px" }}>
                  all reviews →
                </span>
              </Link>
            </div>

            {reviews.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 0" }}>
                <p style={{ fontFamily: "cursive", fontSize: 16, color: "#bbb" }}>no reviews yet — go log a drink!</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {reviews.slice(0, 20).map((r: any) => (
                  <div
                    key={r.id}
                    onClick={() => setSelectedReview(r)}
                    style={{
                      background: "white", border: "1px solid #e8e8e4",
                      borderRadius: 12, padding: "14px 16px", cursor: "pointer",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                      <div style={{ flex: 1, minWidth: 0, marginRight: 12 }}>
                        <p style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 16, margin: "0 0 2px", color: "#1a1a1a" }}>
                          {r.item_name ?? "drink"}
                        </p>
                        <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "#888", margin: 0 }}>
                          {r.place?.name ?? "unknown shop"} · {timeAgo(r.created_at)}
                        </p>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
                        <span style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 18, color: "#1a1a1a" }}>
                          {r.score.toFixed(1)}
                        </span>
                        <StarRow score={r.score} />
                      </div>
                    </div>
                    {/* Tiny photo strip */}
                    {(r.image_urls ?? []).length > 0 && (
                      <div style={{ display: "flex", gap: 4, marginTop: 8 }}>
                        {r.image_urls.slice(0, 4).map((url: string, i: number) => (
                          <img key={i} src={url} alt="" style={{ width: 44, height: 44, objectFit: "cover", borderRadius: 6 }} />
                        ))}
                        {r.image_urls.length > 4 && (
                          <div style={{ width: 44, height: 44, borderRadius: 6, background: "#e8e8e4", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: "#888" }}>
                            +{r.image_urls.length - 4}
                          </div>
                        )}
                      </div>
                    )}
                    {(r.note ?? r.body) && (
                      <p style={{ fontFamily: "cursive", fontSize: 14, color: "#555", margin: "8px 0 0", lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as any, overflow: "hidden" }}>
                        {r.note ?? r.body}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Photos tab — masonry-style collage */}
        {tab === "photos" && (
          <>
            {allPhotos.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 0" }}>
                <p style={{ fontFamily: "cursive", fontSize: 16, color: "#bbb" }}>no photos yet — add some when logging!</p>
                <Link href="/log">
                  <button style={{ marginTop: 12, fontFamily: "'DM Sans', sans-serif", fontSize: 13, background: "#2d6a4f", color: "#fff", border: "none", borderRadius: 8, padding: "10px 20px", cursor: "pointer" }}>
                    log a drink
                  </button>
                </Link>
              </div>
            ) : (
              <div style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr",
                gap: 3, borderRadius: 4, overflow: "hidden",
              }}>
                {allPhotos.map(({ url, review: r }, i) => (
                  <div
                    key={`${r.id}-${i}`}
                    onClick={() => setSelectedReview(r)}
                    style={{ position: "relative", aspectRatio: "1/1", cursor: "pointer" }}
                  >
                    <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                    {/* Score overlay on hover-like dimming for first photo */}
                    <div style={{
                      position: "absolute", bottom: 0, left: 0, right: 0,
                      background: "linear-gradient(to top, rgba(0,0,0,0.45) 0%, transparent 100%)",
                      padding: "8px 6px 4px",
                      display: "flex", alignItems: "flex-end", justifyContent: "space-between",
                    }}>
                      <span style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 11, color: "#fff" }}>
                        {r.score.toFixed(1)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Review modal */}
      {selectedReview && (
        <ReviewModal
          review={{ ...selectedReview, profile: { id: userId, username: handle, display_name: name } }}
          currentUserId={userId}
          onClose={() => setSelectedReview(null)}
          onUpdated={updated => {
            setReviews(prev => prev.map(r => r.id === updated.id ? { ...r, ...updated } : r))
            setSelectedReview(null)
          }}
        />
      )}
    </AppShell>
  )
}
