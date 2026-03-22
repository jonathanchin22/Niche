"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { useInfiniteQuery } from "@tanstack/react-query"
import { createBrowserClient } from "@supabase/ssr"
import { getUserReviews } from "@niche/database"
import { MonoLabel } from "@/components/ui/Primitives"
import ReviewCard from "@/components/feed/ReviewCard"
import type { Review } from "@niche/shared-types"

const APP_ID = "brew" as const

function getSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

interface Props {
  profile: any
  userId: string
  followingCount: number
  followerCount: number
  highestRatedCoffee: string | null
}

export default function ProfileClient({ profile, userId, followingCount, followerCount, highestRatedCoffee }: Props) {
  const router = useRouter()
  const [tab, setTab] = useState<"reviews" | "photos">("reviews")
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const { data, isLoading } = useInfiniteQuery({
    queryKey: ["profile-brew-reviews", userId],
    queryFn: ({ pageParam }) =>
      getUserReviews(getSupabase(), { user_id: userId, app_id: APP_ID, cursor: pageParam as string | undefined }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: last => last.has_more ? last.cursor ?? undefined : undefined,
  })

  const reviews = data?.pages.flatMap(p => p.data.map(i => i.review).filter(Boolean)) as Review[] ?? []
  const withPhotos = reviews.filter(
    (r): r is Review & { image_urls: [string, ...string[]] } =>
      Array.isArray(r.image_urls) && r.image_urls.length > 0 && Boolean(r.image_urls[0])
  )
  const uniqueCafes = new Set(reviews.map(r => r.place_id)).size


  const displayName = profile?.display_name ?? profile?.username ?? "you"
  const bioText = profile?.bio?.trim() || "No description yet."
  const locationText = profile?.location?.trim() || "No location set"
  const topCoffeeText = highestRatedCoffee || "No rated coffee yet"

  useEffect(() => {
    if (!menuOpen) return

    const closeMenu = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false)
      }
    }

    document.addEventListener("mousedown", closeMenu)
    return () => document.removeEventListener("mousedown", closeMenu)
  }, [menuOpen])

  return (
    <div style={{ paddingBottom: 20 }}>
      {/* Header */}
      <div style={{ padding: "52px 28px 0" }}>
        <div style={{ display: "flex", gap: 20, alignItems: "flex-start", marginBottom: 24 }}>
          {/* Avatar */}
          <div style={{
            width: 70, height: 70, borderRadius: 4, overflow: "hidden",
            flexShrink: 0, border: "1px solid var(--c-rule)",
            background: "var(--c-accent-bg)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            {profile?.avatar_url ? (
              <Image
                src={profile.avatar_url}
                alt=""
                width={70}
                height={70}
                sizes="70px"
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              <span style={{ fontFamily: "var(--font-display)", fontSize: 28, color: "var(--c-accent)", fontStyle: "italic" }}>
                {displayName[0]?.toUpperCase()}
              </span>
            )}
          </div>


          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12, justifyContent: "space-between" }}>
              <h2 style={{
                fontFamily: "var(--font-display)", fontSize: 28, margin: "0 0 2px",
                fontWeight: 400, fontStyle: "italic", color: "var(--c-ink)",
              }}>
                {displayName}
              </h2>
              <div ref={menuRef} style={{ position: "relative" }}>
                <button
                  type="button"
                  aria-label="Open profile options"
                  onClick={() => setMenuOpen(open => !open)}
                  style={{
                    width: 32,
                    height: 32,
                    border: "1px solid var(--c-rule)",
                    borderRadius: 8,
                    background: "none",
                    cursor: "pointer",
                    color: "var(--c-subtle)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: 0,
                    flexShrink: 0,
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M12 5h.01M12 12h.01M12 19h.01" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
                  </svg>
                </button>

                {menuOpen && (
                  <div style={{
                    position: "absolute",
                    top: 38,
                    right: 0,
                    minWidth: 190,
                    background: "var(--c-bg)",
                    border: "1px solid var(--c-rule)",
                    borderRadius: 10,
                    boxShadow: "0 10px 28px rgba(0,0,0,0.12)",
                    padding: 6,
                    zIndex: 10,
                  }}>
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false)
                        router.push("/profile/edit")
                      }}
                      style={{
                        width: "100%",
                        textAlign: "left",
                        border: "none",
                        background: "none",
                        padding: "10px 10px",
                        borderRadius: 8,
                        cursor: "pointer",
                        color: "var(--c-ink)",
                        fontFamily: "var(--font-mono)",
                        fontSize: 11,
                      }}
                    >
                      Edit profile
                    </button>
                    <div style={{
                      padding: "8px 10px",
                      color: "var(--c-subtle)",
                      fontFamily: "var(--font-mono)",
                      fontSize: 10,
                      borderTop: "1px solid var(--c-rule)",
                    }}>
                      Settings (coming soon)
                    </div>
                    <div style={{
                      padding: "8px 10px",
                      color: "var(--c-subtle)",
                      fontFamily: "var(--font-mono)",
                      fontSize: 10,
                    }}>
                      App connections (coming soon)
                    </div>
                    <div style={{
                      padding: "8px 10px",
                      color: "var(--c-subtle)",
                      fontFamily: "var(--font-mono)",
                      fontSize: 10,
                    }}>
                      Account management (coming soon)
                    </div>
                  </div>
                )}
              </div>
            </div>

            <p style={{ fontFamily: "var(--font-hand)", fontSize: 14, color: "var(--c-subtle)", margin: 0 }}>
              {bioText}
            </p>

            <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--c-subtle)", padding: "6px 0" }}>
                highest rated: {topCoffeeText}
              </div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--c-subtle)", padding: "6px 0" }}>
                location: {locationText}
              </div>
            </div>
          </div>
        </div>

        {/* Stats bar */}
        <div style={{
          borderTop: "1px solid var(--c-rule)", borderBottom: "1px solid var(--c-rule)",
          display: "flex", padding: "16px 0",
        }}>
          {[
            [String(reviews.length), "drinks logged"],
            [String(uniqueCafes),    "cafes visited"],
            [String(followingCount), "following"],
          ].map(([v, l], i) => (
            <div key={l} style={{
              flex: 1, textAlign: "center",
              borderRight: i < 2 ? "1px solid var(--c-rule)" : "none",
            }}>
              <p style={{
                fontFamily: "var(--font-mono)", fontSize: 22, margin: "0 0 2px",
                color: "var(--c-ink)", letterSpacing: "-0.02em",
              }}>
                {v}
              </p>
              <MonoLabel>{l}</MonoLabel>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: "1px solid var(--c-rule)" }}>
        {(["reviews", "photos"] as const).map(t => (
          <button key={t} type="button" onClick={() => setTab(t)} style={{
            flex: 1, padding: "14px", background: "none", border: "none",
            borderBottom: `2px solid ${tab === t ? "var(--c-accent)" : "transparent"}`,
            fontFamily: "var(--font-mono)", fontSize: 9,
            color: tab === t ? "var(--c-accent)" : "var(--c-subtle)",
            cursor: "pointer", letterSpacing: "0.12em", textTransform: "uppercase",
            marginBottom: -1,
          }}>
            {t}
          </button>
        ))}
      </div>

      {isLoading && (
        <div style={{ padding: "40px 28px", textAlign: "center" }}>
          <MonoLabel>loading...</MonoLabel>
        </div>
      )}

      {/* Reviews tab */}
      {!isLoading && tab === "reviews" && (
        <div style={{ padding: "0 28px" }}>
          {reviews.length === 0 ? (
            <div style={{ paddingTop: 32, textAlign: "center" }}>
              <p style={{ fontFamily: "var(--font-hand)", fontSize: 16, color: "var(--c-subtle)" }}>
                No drinks logged yet. Tap + to start!
              </p>
            </div>
          ) : reviews.map(r => (
            <ReviewCard key={r.id} review={r} />
          ))}
        </div>
      )}

      {/* Photos tab */}
      {!isLoading && tab === "photos" && (
        <div style={{ padding: "16px 28px" }}>
          {withPhotos.length === 0 ? (
            <p style={{ fontFamily: "var(--font-hand)", fontSize: 15, color: "var(--c-subtle)" }}>
              No photos yet.
            </p>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              {withPhotos.map(r => (
                <div key={r.id} style={{
                  borderRadius: 4, overflow: "hidden",
                  background: "var(--c-tint)", position: "relative", paddingBottom: "100%",
                }}>
                  <Image
                    src={r.image_urls[0]} alt={r.item_name ?? ""}
                    fill
                    sizes="(max-width: 768px) 50vw, 220px"
                    style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

    </div>
  )
}
