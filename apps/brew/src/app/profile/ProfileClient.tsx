"use client"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { useInfiniteQuery } from "@tanstack/react-query"
import { createBrowserClient } from "@supabase/ssr"
import { getUserReviews } from "@niche/database"
import { MonoLabel, Stars } from "@/components/ui/Primitives"
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
}

export default function ProfileClient({ profile, userId, followingCount, followerCount }: Props) {
  const router = useRouter()
  const [tab, setTab] = useState<"reviews" | "photos">("reviews")
  const [avatar, setAvatar] = useState<string | null>(profile?.avatar_url ?? null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editorImage, setEditorImage] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)
  const [xOffset, setXOffset] = useState(0.5)
  const [yOffset, setYOffset] = useState(0.5)
  const avRef = useRef<HTMLInputElement>(null)

  const { data, isLoading } = useInfiniteQuery({
    queryKey: ["profile-brew-reviews", userId],
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

  const openAvatarEditor = (file: File) => {
    const reader = new FileReader()
    reader.onload = (event) => {
      const base64 = event.target?.result as string
      setEditorImage(base64)
      setZoom(1)
      setXOffset(0.5)
      setYOffset(0.5)
      setEditorOpen(true)
    }
    reader.readAsDataURL(file)
  }

  const cropAndSave = async () => {
    if (!editorImage) return

    const img = new Image()
    img.src = editorImage
    await new Promise((resolve) => { img.onload = () => resolve(null) })

    const size = 256
    const canvas = document.createElement("canvas")
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const scaledW = img.width * zoom
    const scaledH = img.height * zoom

    const sx = Math.max(0, Math.min(img.width - size / zoom, (img.width - size / zoom) * xOffset))
    const sy = Math.max(0, Math.min(img.height - size / zoom, (img.height - size / zoom) * yOffset))

    ctx.drawImage(
      img,
      sx, sy, size / zoom, size / zoom,
      0, 0, size, size
    )

    const croppedBase64 = canvas.toDataURL("image/png")
    setAvatar(croppedBase64)

    try {
      const { error } = await getSupabase()
        .from("profiles")
        .update({ avatar_url: croppedBase64 })
        .eq("id", userId)
      if (error) throw error
    } catch (err) {
      console.error("Failed to update avatar:", err)
    }

    setEditorOpen(false)
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
            onChange={async (e) => {
              const f = e.target.files?.[0]
              if (f) {
                openAvatarEditor(f)
              }
            }}
          />

          {editorOpen && editorImage && (
            <div style={{
              position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)",
              display: "flex", alignItems: "center", justifyContent: "center",
              padding: 20, zIndex: 9999,
            }}>
              <div style={{
                background: "var(--c-bg)", borderRadius: 12, width: "100%", maxWidth: 420,
                padding: 20, boxShadow: "0 16px 40px rgba(0,0,0,0.25)",
              }}>
                <h3 style={{ fontFamily: "var(--font-display)", fontSize: 18, margin: 0, marginBottom: 12 }}>
                  Edit profile photo
                </h3>
                <div style={{ border: "1px solid var(--c-rule)", borderRadius: 8, overflow: "hidden", position: "relative", height: 260, marginBottom: 12 }}>
                  <img
                    src={editorImage}
                    alt="Editor"
                    style={{
                      position: "absolute", top: 0, left: 0,
                      width: "auto", height: "100%",
                      transform: `scale(${zoom}) translate(${(xOffset - 0.5) * 100}%, ${(yOffset - 0.5) * 100}%)`,
                      transformOrigin: "center",
                    }}
                  />
                  <div style={{
                    position: "absolute", inset: 0,
                    border: "2px dashed var(--c-accent)",
                    pointerEvents: "none",
                  }} />
                </div>

                <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
                  <div style={{ flex: 1 }}>
                    <MonoLabel style={{ display: "block", marginBottom: 4 }}>zoom</MonoLabel>
                    <input
                      type="range" min={1} max={3} step={0.05} value={zoom}
                      onChange={e => setZoom(Number(e.target.value))}
                      style={{ width: "100%" }}
                    />
                  </div>
                  <div style={{ width: 120 }}>
                    <MonoLabel style={{ display: "block", marginBottom: 4 }}>x offset</MonoLabel>
                    <input
                      type="range" min={0} max={1} step={0.01} value={xOffset}
                      onChange={e => setXOffset(Number(e.target.value))}
                      style={{ width: "100%" }}
                    />
                  </div>
                </div>

                <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
                  <div style={{ flex: 1 }}>
                    <MonoLabel style={{ display: "block", marginBottom: 4 }}>y offset</MonoLabel>
                    <input
                      type="range" min={0} max={1} step={0.01} value={yOffset}
                      onChange={e => setYOffset(Number(e.target.value))}
                      style={{ width: "100%" }}
                    />
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                  <button
                    type="button"
                    onClick={() => setEditorOpen(false)}
                    style={{
                      padding: "10px 14px", border: "1px solid var(--c-rule)", borderRadius: 8,
                      background: "none", cursor: "pointer",
                      fontFamily: "var(--font-mono)", fontSize: 10,
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={cropAndSave}
                    style={{
                      padding: "10px 14px", border: "none", borderRadius: 8,
                      background: "var(--c-accent)", color: "white", cursor: "pointer",
                      fontFamily: "var(--font-mono)", fontSize: 10,
                    }}
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>
          )}

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
