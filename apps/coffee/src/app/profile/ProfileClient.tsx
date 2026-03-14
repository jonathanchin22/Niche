"use client"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { useInfiniteQuery } from "@tanstack/react-query"
import { createBrowserClient } from "@supabase/ssr"
import { getUserReviews } from "@niche/database"
import { MonoLabel, Stars } from "@/components/ui/Primitives"
import ReviewCard from "@/components/feed/ReviewCard"
import type { Review } from "@niche/shared-types"

const APP_ID = "coffee" as const

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
}

export default function ProfileClient({ profile, userId, followingCount, followerCount }: Props) {
  const router = useRouter()
  const [tab, setTab] = useState<"reviews" | "photos">("reviews")
  const [avatar, setAvatar] = useState<string | null>(profile?.avatar_url ?? null)
  const avRef = useRef<HTMLInputElement>(null)

  const { data, isLoading } = useInfiniteQuery({
    queryKey: ["profile-coffee-reviews", userId],
    queryFn: ({ pageParam }) =>
      getUserReviews(getSupabase(), { user_id: userId, app_id: APP_ID, cursor: pageParam as string | undefined }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: last => last.has_more ? last.cursor ?? undefined : undefined,
  })

  const reviews = data?.pages.flatMap(p => p.data.map(i => i.review).filter(Boolean)) as Review[] ?? []
  const withPhotos = reviews.filter(r => r.image_urls?.length > 0)
  const uniqueCafes = new Set(reviews.map(r => r.place_id)).size

  const handleSignOut = async () => {
    await getSupabase().auth.signOut()
    router.push("/auth/login")
  }

  const displayName = profile?.display_name ?? profile?.username ?? "you"

  return (
    <div style={{ paddingBottom: 20 }}>
      {/* Header */}
      <div style={{ padding: "52px 28px 0" }}>
        <div style={{ display: "flex", gap: 20, alignItems: "flex-start", marginBottom: 24 }}>
          {/* Avatar */}
          <div
            onClick={() => avRef.current?.click()}
            style={{
              width: 70, height: 70, borderRadius: 4, overflow: "hidden",
              flexShrink: 0, border: "1px solid var(--c-rule)",
              cursor: "pointer", background: "var(--c-accent-bg)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            {avatar ? (
              <img src={avatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <span style={{ fontFamily: "var(--font-display)", fontSize: 28, color: "var(--c-accent)", fontStyle: "italic" }}>
                {displayName[0]?.toUpperCase()}
              </span>
            )}
          </div>
          <input
            ref={avRef} type="file" accept="image/*" style={{ display: "none" }}
            onChange={e => {
              const f = e.target.files?.[0]
              if (f) setAvatar(URL.createObjectURL(f))
              // TODO: upload to supabase storage + updateProfile
            }}
          />

          <div style={{ flex: 1 }}>
            <h2 style={{
              fontFamily: "var(--font-display)", fontSize: 28, margin: "0 0 2px",
              fontWeight: 400, fontStyle: "italic", color: "var(--c-ink)",
            }}>
              {displayName}
            </h2>
            {profile?.bio && (
              <p style={{ fontFamily: "var(--font-hand)", fontSize: 14, color: "var(--c-subtle)", margin: 0 }}>
                {profile.bio}
              </p>
            )}
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
                  <img
                    src={r.image_urls[0]} alt={r.item_name ?? ""}
                    style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Sign out */}
      <div style={{ padding: "32px 28px 0" }}>
        <button
          type="button"
          onClick={handleSignOut}
          style={{
            width: "100%", background: "none",
            border: "1px solid var(--c-rule)", padding: "14px",
            fontFamily: "var(--font-mono)", fontSize: 10,
            color: "var(--c-subtle)", cursor: "pointer",
            letterSpacing: "0.08em", textTransform: "uppercase",
          }}
        >
          sign out
        </button>
      </div>
    </div>
  )
}
