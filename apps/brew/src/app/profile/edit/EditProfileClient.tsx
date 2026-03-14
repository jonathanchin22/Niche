"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { createBrowserClient } from "@supabase/ssr"
import { updateProfile } from "@niche/database"
import { MonoLabel } from "@/components/ui/Primitives"

const CROP_FRAME_SIZE = 280
const AVATAR_OUTPUT_SIZE = 512
const MIN_ZOOM = 1
const MAX_ZOOM = 4

type DragStart = {
  pointerId: number
  startX: number
  startY: number
  originX: number
  originY: number
}

type PointerPoint = {
  x: number
  y: number
}

type PinchStart = {
  startDistance: number
  startZoom: number
  startMidpoint: PointerPoint
  originX: number
  originY: number
}

function getSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

interface Props {
  profile: any
  userId: string
  highestRatedCoffee: string | null
}

export default function EditProfileClient({ profile, userId, highestRatedCoffee }: Props) {
  const router = useRouter()
  const [description, setDescription] = useState(profile?.bio ?? "")
  const [location, setLocation] = useState(profile?.location ?? "")
  const [avatar, setAvatar] = useState<string | null>(profile?.avatar_url ?? null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editorImage, setEditorImage] = useState<string | null>(null)
  const [editorImageElement, setEditorImageElement] = useState<HTMLImageElement | null>(null)
  const [zoom, setZoom] = useState(1)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [avatarSaving, setAvatarSaving] = useState(false)
  const [saving, setSaving] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const dragStartRef = useRef<DragStart | null>(null)
  const activePointersRef = useRef<Map<number, PointerPoint>>(new Map())
  const pinchStartRef = useRef<PinchStart | null>(null)

  const getRenderedImageSize = (zoomLevel: number) => {
    if (!editorImageElement) {
      return { width: CROP_FRAME_SIZE, height: CROP_FRAME_SIZE }
    }

    const coverScale = Math.max(
      CROP_FRAME_SIZE / editorImageElement.naturalWidth,
      CROP_FRAME_SIZE / editorImageElement.naturalHeight
    )

    return {
      width: editorImageElement.naturalWidth * coverScale * zoomLevel,
      height: editorImageElement.naturalHeight * coverScale * zoomLevel,
    }
  }

  const renderedImageSize = useMemo(() => getRenderedImageSize(zoom), [editorImageElement, zoom])

  const clampPosition = (nextX: number, nextY: number, zoomLevel = zoom) => {
    const nextSize = getRenderedImageSize(zoomLevel)
    const maxX = Math.max(0, (nextSize.width - CROP_FRAME_SIZE) / 2)
    const maxY = Math.max(0, (nextSize.height - CROP_FRAME_SIZE) / 2)

    return {
      x: Math.min(maxX, Math.max(-maxX, nextX)),
      y: Math.min(maxY, Math.max(-maxY, nextY)),
    }
  }

  useEffect(() => {
    setPosition(prev => clampPosition(prev.x, prev.y))
  }, [zoom, renderedImageSize.width, renderedImageSize.height])

  const getDistance = (a: PointerPoint, b: PointerPoint) => {
    const dx = b.x - a.x
    const dy = b.y - a.y
    return Math.sqrt(dx * dx + dy * dy)
  }

  const getMidpoint = (a: PointerPoint, b: PointerPoint) => ({
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
  })

  const beginPinch = () => {
    const pointers = Array.from(activePointersRef.current.values())
    if (pointers.length !== 2) return

    const [first, second] = pointers
    if (!first || !second) return

    pinchStartRef.current = {
      startDistance: Math.max(1, getDistance(first, second)),
      startZoom: zoom,
      startMidpoint: getMidpoint(first, second),
      originX: position.x,
      originY: position.y,
    }
    dragStartRef.current = null
  }

  const handleSignOut = async () => {
    await getSupabase().auth.signOut()
    router.push("/auth/login")
  }

  const openAvatarEditor = (file: File) => {
    const reader = new FileReader()
    reader.onload = (event) => {
      const base64 = event.target?.result as string
      setEditorImage(base64)
      setEditorImageElement(null)
      setZoom(1)
      setPosition({ x: 0, y: 0 })
      setEditorOpen(true)
    }
    reader.readAsDataURL(file)
  }

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!editorImageElement || avatarSaving) return

    activePointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    const pointerCount = activePointersRef.current.size

    if (pointerCount === 1) {
      dragStartRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        originX: position.x,
        originY: position.y,
      }
      pinchStartRef.current = null
    } else if (pointerCount === 2) {
      beginPinch()
    } else {
      dragStartRef.current = null
      pinchStartRef.current = null
    }

    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!activePointersRef.current.has(event.pointerId)) return
    activePointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY })

    if (activePointersRef.current.size === 2 && pinchStartRef.current) {
      const pointers = Array.from(activePointersRef.current.values())
      const [first, second] = pointers
      if (!first || !second) return

      const currentDistance = Math.max(1, getDistance(first, second))
      const currentMidpoint = getMidpoint(first, second)
      const zoomRatio = currentDistance / pinchStartRef.current.startDistance
      const nextZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, pinchStartRef.current.startZoom * zoomRatio))

      const deltaX = currentMidpoint.x - pinchStartRef.current.startMidpoint.x
      const deltaY = currentMidpoint.y - pinchStartRef.current.startMidpoint.y
      const nextPosition = clampPosition(
        pinchStartRef.current.originX + deltaX,
        pinchStartRef.current.originY + deltaY,
        nextZoom
      )

      setZoom(nextZoom)
      setPosition(nextPosition)
      return
    }

    const dragStart = dragStartRef.current
    if (!dragStart || dragStart.pointerId !== event.pointerId) return

    const deltaX = event.clientX - dragStart.startX
    const deltaY = event.clientY - dragStart.startY
    setPosition(clampPosition(dragStart.originX + deltaX, dragStart.originY + deltaY))
  }

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    activePointersRef.current.delete(event.pointerId)

    if (dragStartRef.current?.pointerId === event.pointerId) {
      dragStartRef.current = null
    }

    const pointerCount = activePointersRef.current.size
    if (pointerCount === 2) {
      beginPinch()
    } else if (pointerCount === 1) {
      const remainingPointer = Array.from(activePointersRef.current.entries())[0]
      if (!remainingPointer) {
        pinchStartRef.current = null
        dragStartRef.current = null
      } else {
        const [remainingPointerId, remainingPoint] = remainingPointer
        pinchStartRef.current = null
        dragStartRef.current = {
          pointerId: remainingPointerId,
          startX: remainingPoint.x,
          startY: remainingPoint.y,
          originX: position.x,
          originY: position.y,
        }
      }
    } else {
      pinchStartRef.current = null
      dragStartRef.current = null
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  const cropAndSave = async () => {
    if (!editorImage || !editorImageElement) return

    setAvatarSaving(true)

    try {
      const canvas = document.createElement("canvas")
      canvas.width = AVATAR_OUTPUT_SIZE
      canvas.height = AVATAR_OUTPUT_SIZE
      const ctx = canvas.getContext("2d")
      if (!ctx) return

      const sourceDrawX = (CROP_FRAME_SIZE - renderedImageSize.width) / 2 + position.x
      const sourceDrawY = (CROP_FRAME_SIZE - renderedImageSize.height) / 2 + position.y
      const outputScale = AVATAR_OUTPUT_SIZE / CROP_FRAME_SIZE

      ctx.clearRect(0, 0, AVATAR_OUTPUT_SIZE, AVATAR_OUTPUT_SIZE)
      ctx.drawImage(
        editorImageElement,
        sourceDrawX * outputScale,
        sourceDrawY * outputScale,
        renderedImageSize.width * outputScale,
        renderedImageSize.height * outputScale
      )

      const croppedBase64 = canvas.toDataURL("image/png")
      setAvatar(croppedBase64)

      await updateProfile(getSupabase(), {
        user_id: userId,
        updates: { avatar_url: croppedBase64 },
      })

      router.refresh()
      setEditorOpen(false)
    } catch (err) {
      console.error("Failed to update avatar:", err)
    } finally {
      setAvatarSaving(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await updateProfile(getSupabase(), {
        user_id: userId,
        updates: {
          bio: description || null,
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
                  <div
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerCancel={handlePointerUp}
                    style={{
                      border: "1px solid var(--c-rule)",
                      borderRadius: 12,
                      overflow: "hidden",
                      position: "relative",
                      width: CROP_FRAME_SIZE,
                      height: CROP_FRAME_SIZE,
                      margin: "0 auto 12px",
                      cursor: avatarSaving ? "progress" : "grab",
                      userSelect: "none",
                      touchAction: "none",
                      background: "var(--c-tint)",
                    }}
                  >
                    <img
                      src={editorImage}
                      alt="Editor"
                      onLoad={(e) => setEditorImageElement(e.currentTarget)}
                      style={{
                        position: "absolute",
                        left: "50%",
                        top: "50%",
                        width: renderedImageSize.width,
                        height: renderedImageSize.height,
                        transform: `translate(calc(-50% + ${position.x}px), calc(-50% + ${position.y}px))`,
                        objectFit: "cover",
                        pointerEvents: "none",
                      }}
                    />
                    <div style={{
                      position: "absolute", inset: 0, borderRadius: "50%",
                      border: "2px dashed var(--c-accent)",
                      boxShadow: "0 0 0 9999px rgba(0,0,0,0.24)",
                      pointerEvents: "none",
                    }} />
                  </div>

                  <p style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--c-subtle)", margin: "0 0 12px" }}>
                    Drag to reposition. On touch devices, pinch with two fingers to zoom.
                  </p>

                  <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
                    <div style={{ flex: 1 }}>
                      <MonoLabel style={{ display: "block", marginBottom: 4 }}>zoom</MonoLabel>
                      <input
                        type="range" min={MIN_ZOOM} max={MAX_ZOOM} step={0.05} value={zoom}
                        onChange={e => setZoom(Number(e.target.value))}
                        style={{ width: "100%" }}
                      />
                    </div>
                  </div>

                  <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                    <button
                      type="button"
                      disabled={avatarSaving}
                      onClick={() => setEditorOpen(false)}
                      style={{
                        padding: "10px 14px", border: "1px solid var(--c-rule)", borderRadius: 8,
                        background: "none", cursor: avatarSaving ? "not-allowed" : "pointer",
                        fontFamily: "var(--font-mono)", fontSize: 10,
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={avatarSaving || !editorImageElement}
                      onClick={cropAndSave}
                      style={{
                        padding: "10px 14px", border: "none", borderRadius: 8,
                        background: "var(--c-accent)", color: "white", cursor: avatarSaving ? "not-allowed" : "pointer",
                        fontFamily: "var(--font-mono)", fontSize: 10,
                        opacity: avatarSaving ? 0.7 : 1,
                      }}
                    >
                      {avatarSaving ? "Saving..." : "Save"}
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
              <MonoLabel>Highest rated coffee</MonoLabel>
              <div
                style={{
                  width: "100%",
                  padding: 10,
                  borderRadius: 10,
                  border: "1px solid var(--c-rule)",
                  background: "var(--c-bg)",
                  fontFamily: "var(--font-hand)",
                  fontSize: 14,
                  color: "var(--c-ink)",
                }}
              >
                {highestRatedCoffee || "No rated coffee yet"}
              </div>
              <p style={{ margin: "6px 0 0", fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--c-subtle)" }}>
                This is calculated automatically from your highest-scored drink log.
              </p>
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
