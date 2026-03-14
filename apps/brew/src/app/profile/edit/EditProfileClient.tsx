"use client"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { createBrowserClient } from "@supabase/ssr"
import { updateProfile } from "@niche/database"
import { MonoLabel } from "@/components/ui/Primitives"

function getSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

interface Props {
  profile: any
  userId: string
}

export default function EditProfileClient({ profile, userId }: Props) {
  const router = useRouter()
  const [description, setDescription] = useState(profile?.bio ?? "")
  const [topCoffee, setTopCoffee] = useState(profile?.top_coffee ?? "")
  const [location, setLocation] = useState(profile?.location ?? "")
  const [avatar, setAvatar] = useState<string | null>(profile?.avatar_url ?? null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editorImage, setEditorImage] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)
  const [xOffset, setXOffset] = useState(0.5)
  const [yOffset, setYOffset] = useState(0.5)
  const [saving, setSaving] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

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
      await updateProfile(getSupabase(), {
        user_id: userId,
        updates: { avatar_url: croppedBase64 },
      })
    } catch (err) {
      console.error("Failed to update avatar:", err)
    }

    setEditorOpen(false)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await updateProfile(getSupabase(), {
        user_id: userId,
        updates: {
          bio: description || null,
          top_coffee: topCoffee || null,
          location: location || null,
        },
      })
      router.push("/profile")
    } catch (err) {
      console.error("Failed to update profile:", err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ paddingBottom: 40 }}>
      <div style={{ padding: "52px 28px 0" }}>
        <div style={{ display: "flex", gap: 20, alignItems: "flex-start", marginBottom: 24 }}>
          <div style={{
            width: 70, height: 70, borderRadius: 4, overflow: "hidden",
            flexShrink: 0, border: "1px solid var(--c-rule)",
            background: "var(--c-accent-bg)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            {avatar ? (
              <img src={avatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <span style={{ fontFamily: "var(--font-display)", fontSize: 28, color: "var(--c-accent)", fontStyle: "italic" }}>
                {profile?.display_name?.[0]?.toUpperCase() ?? "U"}
              </span>
            )}
          </div>

          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <h2 style={{
                fontFamily: "var(--font-display)", fontSize: 28, margin: 0,
                fontWeight: 400, fontStyle: "italic", color: "var(--c-ink)",
              }}>
                Edit profile
              </h2>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                style={{
                  padding: "10px 12px", border: "1px solid var(--c-rule)", borderRadius: 8,
                  background: "none", cursor: "pointer", fontFamily: "var(--font-mono)", fontSize: 10,
                  color: "var(--c-subtle)",
                }}
              >
                change photo
              </button>
            </div>

            <p style={{ fontFamily: "var(--font-hand)", fontSize: 14, color: "var(--c-subtle)", margin: "10px 0 0" }}>
              Update your profile info and photo.
            </p>

            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) {
                  openAvatarEditor(file)
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
          </div>
        </div>

        <div style={{ padding: "0 0 36px 0" }}>
          <div style={{ display: "grid", gap: 12 }}>
            <label style={{ display: "block" }}>
              <MonoLabel>Description</MonoLabel>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                style={{
                  width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--c-rule)",
                  fontFamily: "var(--font-hand)", fontSize: 14, minHeight: 84,
                }}
              />
            </label>

            <label style={{ display: "block" }}>
              <MonoLabel>Top coffee</MonoLabel>
              <input
                value={topCoffee}
                onChange={(e) => setTopCoffee(e.target.value)}
                placeholder="eg. AeroPress, Cold Brew"
                style={{
                  width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--c-rule)",
                  fontFamily: "var(--font-hand)", fontSize: 14,
                }}
              />
            </label>

            <label style={{ display: "block" }}>
              <MonoLabel>Location</MonoLabel>
              <input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="eg. Portland, OR"
                style={{
                  width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--c-rule)",
                  fontFamily: "var(--font-hand)", fontSize: 14,
                }}
              />
            </label>
          </div>

          <div style={{ display: "flex", gap: 12, marginTop: 20, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              style={{
                flex: 1, minWidth: 160,
                padding: "14px 18px", borderRadius: 10, border: "none",
                background: "var(--c-accent)", color: "white", cursor: saving ? "not-allowed" : "pointer",
                fontFamily: "var(--font-mono)", fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase",
              }}
            >
              {saving ? "Saving…" : "Save changes"}
            </button>

            <button
              type="button"
              onClick={() => router.push("/profile")}
              style={{
                flex: 1, minWidth: 160,
                padding: "14px 18px", borderRadius: 10, border: "1px solid var(--c-rule)",
                background: "none", cursor: "pointer",
                fontFamily: "var(--font-mono)", fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase",
                color: "var(--c-subtle)",
              }}
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleSignOut}
              style={{
                flex: 1, minWidth: 160,
                padding: "14px 18px", borderRadius: 10, border: "1px solid var(--c-rule)",
                background: "none", cursor: "pointer",
                fontFamily: "var(--font-mono)", fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase",
                color: "var(--c-subtle)",
              }}
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
