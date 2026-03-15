"use client"

import { useState, useEffect } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@niche/auth/client"
import { getProfile, getUserReviews, followUser, unfollowUser, isFollowing } from "@niche/database"
import { ReviewModal } from "@/components/review/ReviewModal"

interface FriendProfileModalProps {
  friendId: string
  currentUserId: string
  onClose: () => void
}

function StarRow({ score }: { score: number }) {
  const pct = score / 10
  return (
    <div style={{ display: "flex", gap: 2 }}>
      {[0, 1, 2, 3, 4].map(i => {
        const fill = Math.max(0, Math.min(1, pct * 5 - i))
        const gid = `sr-fpm-${i}-${Math.round(score * 10)}`
        return (
          <svg key={i} width="12" height="12" viewBox="0 0 24 24">
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
    <svg width="48" height="48" viewBox="0 0 100 100" fill="none">
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

export function FriendProfileModal({ friendId, currentUserId, onClose }: FriendProfileModalProps) {
  const supabase = createClient()
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<"reviews" | "photos">("reviews")
  const [selectedReview, setSelectedReview] = useState<any | null>(null)

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ["friendProfile", friendId],
    queryFn: () => getProfile(supabase as any, friendId),
  })

  const { data: reviewsData, isLoading: reviewsLoading } = useQuery({
    queryKey: ["friendReviews", friendId],
    queryFn: async () => {
      const result = await getUserReviews(supabase as any, { user_id: friendId, app_id: "boba" })
      return (result.data ?? []).map((item: any) => item.review ?? item)
    },
  })

  const { data: followingStatus } = useQuery({
    queryKey: ["isFollowing", currentUserId, friendId],
    queryFn: () => isFollowing(supabase as any, { follower_id: currentUserId, following_id: friendId }),
  })

  const { mutate: toggleFollow, isPending: followPending } = useMutation({
    mutationFn: async () => {
      if (followingStatus) {
        await unfollowUser(supabase as any, { follower_id: currentUserId, following_id: friendId })
      } else {
        await followUser(supabase as any, { follower_id: currentUserId, following_id: friendId })
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["isFollowing", currentUserId, friendId] })
      queryClient.invalidateQueries({ queryKey: ["following", currentUserId] })
    },
  })

  const reviews = reviewsData ?? []
  const name = profile?.display_name ?? profile?.username ?? "unknown"
  const handle = profile?.username ?? ""
  const uniquePlaces = new Set(reviews.map((r: any) => r.place_id)).size
  const allPhotos = reviews.flatMap((r: any) =>
    (r.image_urls ?? []).map((url: string) => ({ url, review: r }))
  )

  const isLoading = profileLoading || reviewsLoading

  // Close on backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose()
  }

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !selectedReview) onClose() }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [onClose, selectedReview])

  return (
    <>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Caveat:wght@400;600&family=DM+Serif+Display:ital@0;1&family=DM+Sans:wght@300;400;500&display=swap');`}</style>

      {/* Backdrop */}
      <div
        onClick={handleBackdropClick}
        style={{
          position: "fixed", inset: 0, zIndex: 1000,
          background: "rgba(0,0,0,0.45)",
          display: "flex", alignItems: "flex-end", justifyContent: "center",
        }}
      >
        {/* Sheet */}
        <div
          style={{
            width: "100%", maxWidth: 480,
            maxHeight: "90vh",
            background: "#fafaf8",
            borderRadius: "20px 20px 0 0",
            overflow: "hidden",
            display: "flex", flexDirection: "column",
          }}
        >
          {/* Drag handle */}
          <div style={{ padding: "12px 0 0", display: "flex", justifyContent: "center" }}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: "#ddd" }} />
          </div>

          {/* Close button */}
          <div style={{ display: "flex", justifyContent: "flex-end", padding: "8px 16px 0" }}>
            <button
              onClick={onClose}
              aria-label="Close"
              style={{
                background: "none", border: "none", cursor: "pointer",
                color: "#888", fontSize: 22, lineHeight: 1, padding: 4,
              }}
            >×</button>
          </div>

          {/* Scrollable content */}
          <div style={{ overflowY: "auto", flex: 1, padding: "0 24px 32px", fontFamily: "'DM Sans', sans-serif" }}>

            {isLoading ? (
              <div style={{ textAlign: "center", padding: "48px 0" }}>
                <p style={{ fontFamily: "'Caveat', cursive", fontSize: 16, color: "#bbb" }}>loading...</p>
              </div>
            ) : (
              <>
                {/* Profile header */}
                <div style={{ display: "flex", alignItems: "flex-start", gap: 16, marginBottom: 20 }}>
                  <div style={{
                    width: 64, height: 64, border: "1.5px solid #e8e8e4",
                    borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0, background: "#e8f4ee",
                  }}>
                    <ProfileSketch />
                  </div>
                  <div style={{ paddingTop: 6, flex: 1 }}>
                    <h2 style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 20, margin: "0 0 2px", fontWeight: 400, color: "#1a1a1a" }}>
                      {name}
                    </h2>
                    {handle && (
                      <p style={{ fontFamily: "'Caveat', cursive", fontSize: 14, color: "#888", margin: 0 }}>@{handle}</p>
                    )}
                  </div>
                  <button
                    onClick={() => toggleFollow()}
                    disabled={followPending}
                    style={{
                      fontFamily: "'DM Sans', sans-serif", fontSize: 13,
                      padding: "7px 18px", borderRadius: 20, marginTop: 8,
                      border: `1px solid ${followingStatus ? "#e8e8e4" : "#2d6a4f"}`,
                      background: followingStatus ? "transparent" : "#e8f4ee",
                      color: followingStatus ? "#888" : "#2d6a4f",
                      cursor: followPending ? "default" : "pointer",
                      flexShrink: 0,
                    }}
                  >
                    {followingStatus ? "following" : "+ follow"}
                  </button>
                </div>

                {/* Stats */}
                <div style={{
                  display: "grid", gridTemplateColumns: "repeat(3, 1fr)",
                  border: "1px solid #e8e8e4", borderRadius: 12, overflow: "hidden", marginBottom: 20,
                }}>
                  {[
                    { label: "drinks", value: reviews.length },
                    { label: "shops", value: uniquePlaces },
                    { label: "photos", value: allPhotos.length },
                  ].map(({ label, value }, i) => (
                    <div key={label} style={{
                      padding: "12px 8px", textAlign: "center",
                      borderRight: i < 2 ? "1px solid #e8e8e4" : "none",
                    }}>
                      <p style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 22, margin: "0 0 2px", color: "#1a1a1a" }}>{value}</p>
                      <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 10, color: "#888", margin: 0, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</p>
                    </div>
                  ))}
                </div>

                {/* Tab switcher */}
                <div style={{ display: "flex", borderBottom: "1px solid #e8e8e4", marginBottom: 16, gap: 0 }}>
                  {(["reviews", "photos"] as const).map(t => (
                    <button
                      key={t}
                      onClick={() => setTab(t)}
                      style={{
                        flex: 1, fontFamily: "'DM Sans', sans-serif", fontSize: 12,
                        padding: "9px 0", background: "none", border: "none",
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
                    {reviews.length === 0 ? (
                      <div style={{ textAlign: "center", padding: "32px 0" }}>
                        <p style={{ fontFamily: "'Caveat', cursive", fontSize: 16, color: "#bbb" }}>no reviews yet</p>
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
                                <p style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 15, margin: "0 0 2px", color: "#1a1a1a" }}>
                                  {r.item_name ?? "drink"}
                                </p>
                                <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: "#888", margin: 0 }}>
                                  {r.place?.name ?? "unknown shop"} · {timeAgo(r.created_at)}
                                </p>
                              </div>
                              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3, flexShrink: 0 }}>
                                <span style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 17, color: "#1a1a1a" }}>
                                  {r.score.toFixed(1)}
                                </span>
                                <StarRow score={r.score} />
                              </div>
                            </div>
                            {(r.image_urls ?? []).length > 0 && (
                              <div style={{ display: "flex", gap: 4, marginTop: 8 }}>
                                {r.image_urls.slice(0, 4).map((url: string, i: number) => (
                                  <img key={i} src={url} alt="" style={{ width: 40, height: 40, objectFit: "cover", borderRadius: 6 }} />
                                ))}
                                {r.image_urls.length > 4 && (
                                  <div style={{ width: 40, height: 40, borderRadius: 6, background: "#e8e8e4", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans', sans-serif", fontSize: 10, color: "#888" }}>
                                    +{r.image_urls.length - 4}
                                  </div>
                                )}
                              </div>
                            )}
                            {r.body && (
                              <p style={{ fontFamily: "'Caveat', cursive", fontSize: 13, color: "#555", margin: "6px 0 0", lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as any, overflow: "hidden" }}>
                                {r.body}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}

                {/* Photos tab */}
                {tab === "photos" && (
                  <>
                    {allPhotos.length === 0 ? (
                      <div style={{ textAlign: "center", padding: "32px 0" }}>
                        <p style={{ fontFamily: "'Caveat', cursive", fontSize: 16, color: "#bbb" }}>no photos yet</p>
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
                            <div style={{
                              position: "absolute", bottom: 0, left: 0, right: 0,
                              background: "linear-gradient(to top, rgba(0,0,0,0.45) 0%, transparent 100%)",
                              padding: "8px 6px 4px",
                              display: "flex", alignItems: "flex-end",
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
              </>
            )}
          </div>
        </div>
      </div>

      {/* Review modal (read-only — not current user's review) */}
      {selectedReview && (
        <ReviewModal
          review={{ ...selectedReview, profile: { id: friendId, username: handle, display_name: name } }}
          currentUserId={currentUserId}
          onClose={() => setSelectedReview(null)}
        />
      )}
    </>
  )
}
