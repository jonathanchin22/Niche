"use client"

import { useState, useRef } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@niche/auth/client"
import { updateReview } from "@niche/database"

interface Review {
  id: string
  user_id: string
  item_name: string | null
  score: number
  note: string | null
  body: string | null
  tags: string[]
  image_urls: string[]
  created_at: string
  place?: { id: string; name: string; city?: string; state?: string; address?: string } | null
  profile?: { id: string; username?: string; display_name?: string } | null
}

interface ReviewModalProps {
  review: Review
  currentUserId: string
  onClose: () => void
  onUpdated?: (updated: Review) => void
}

const DESCRIPTORS = [
  "creamy", "sweet", "earthy", "fruity", "bold", "delicate",
  "chewy pearls", "great value", "fresh", "rich", "light", "classic",
]

// ─── Star display (partial fill, 0–10) ───────────────────────────────────────
function StarDisplay({ score, size = 18 }: { score: number; size?: number }) {
  const pct = score / 10
  return (
    <div style={{ display: "flex", gap: 3 }}>
      {[0, 1, 2, 3, 4].map(i => {
        const fill = Math.max(0, Math.min(1, pct * 5 - i))
        const gid = `rm-${i}-${Math.round(score * 10)}-${size}`
        return (
          <svg key={i} width={size} height={size} viewBox="0 0 24 24">
            <defs>
              <linearGradient id={gid}>
                <stop offset={`${fill * 100}%`} stopColor="#c9a84c" />
                <stop offset={`${fill * 100}%`} stopColor="#e8e8e4" />
              </linearGradient>
            </defs>
            <path d="M12 2l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17l-5.9 3 1.2-6.5L2.5 9l6.6-.9z" fill={`url(#${gid})`} />
          </svg>
        )
      })}
    </div>
  )
}

// ─── Slider rating ────────────────────────────────────────────────────────────
function StarSlider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <style>{`.rm-slider{-webkit-appearance:none;appearance:none;width:100%;height:4px;border-radius:4px;outline:none;cursor:pointer;}.rm-slider::-webkit-slider-thumb{-webkit-appearance:none;width:20px;height:20px;border-radius:50%;background:#fff;border:2px solid #c9a84c;box-shadow:0 1px 4px rgba(0,0,0,.15);cursor:pointer;}.rm-slider::-moz-range-thumb{width:20px;height:20px;border-radius:50%;background:#fff;border:2px solid #c9a84c;cursor:pointer;}`}</style>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <StarDisplay score={value} size={16} />
        <span style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 26, color: "#1a1a1a", minWidth: 44 }}>
          {value.toFixed(1)}
        </span>
        <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: "#bbb" }}>/ 10</span>
      </div>
      <input
        type="range" className="rm-slider"
        min={0} max={10} step={0.1} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        style={{ background: `linear-gradient(to right, #c9a84c ${value * 10}%, #e8e8e4 ${value * 10}%)` }}
      />
    </div>
  )
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return "today"
  if (days === 1) return "yesterday"
  if (days < 7) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

// ─── Photo thumbnail grid ─────────────────────────────────────────────────────
function PhotoGrid({ urls, onRemove }: { urls: string[]; onRemove?: (url: string) => void }) {
  const [lightbox, setLightbox] = useState<string | null>(null)
  if (urls.length === 0) return null
  return (
    <>
      <div style={{
        display: "grid",
        gridTemplateColumns: urls.length === 1 ? "1fr" : urls.length === 2 ? "1fr 1fr" : "1fr 1fr 1fr",
        gap: 4, borderRadius: 10, overflow: "hidden", marginBottom: 12,
      }}>
        {urls.map((url, i) => (
          <div key={url} style={{ position: "relative", aspectRatio: urls.length === 1 ? "16/9" : "1/1" }}>
            <img
              src={url} alt=""
              onClick={() => setLightbox(url)}
              style={{ width: "100%", height: "100%", objectFit: "cover", cursor: "pointer", display: "block" }}
            />
            {onRemove && (
              <button
                onClick={e => { e.stopPropagation(); onRemove(url) }}
                style={{
                  position: "absolute", top: 4, right: 4,
                  background: "rgba(0,0,0,0.55)", color: "#fff",
                  border: "none", borderRadius: "50%", width: 22, height: 22,
                  fontSize: 13, cursor: "pointer", display: "flex",
                  alignItems: "center", justifyContent: "center", lineHeight: 1,
                }}
              >×</button>
            )}
          </div>
        ))}
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div
          onClick={() => setLightbox(null)}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)",
            zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center",
            padding: 20,
          }}
        >
          <img src={lightbox} alt="" style={{ maxWidth: "100%", maxHeight: "90vh", objectFit: "contain", borderRadius: 8 }} />
          <button
            onClick={() => setLightbox(null)}
            style={{
              position: "absolute", top: 20, right: 20,
              background: "none", border: "none", color: "#fff",
              fontSize: 28, cursor: "pointer", lineHeight: 1,
            }}
          >×</button>
        </div>
      )}
    </>
  )
}

// ─── Photo picker — uses local file → base64 for now (no storage needed) ──────
// In production you'd upload to Supabase Storage and store the URL.
// For the MVP we store base64 inline in image_urls (works for demos, not ideal for scale).
function PhotoPicker({ urls, onChange }: { urls: string[]; onChange: (urls: string[]) => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    setUploading(true)
    const newUrls: string[] = []
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) continue
      const compressed = await compressImage(file, 800)
      newUrls.push(compressed)
    }
    onChange([...urls, ...newUrls].slice(0, 6)) // cap at 6 photos
    setUploading(false)
  }

  return (
    <div>
      <PhotoGrid urls={urls} onRemove={url => onChange(urls.filter(u => u !== url))} />
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        style={{ display: "none" }}
        onChange={e => handleFiles(e.target.files)}
      />
      {urls.length < 6 && (
        <button
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          style={{
            display: "flex", alignItems: "center", gap: 8,
            fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "#2d6a4f",
            background: "#e8f4ee", border: "1px dashed #2d6a4f",
            borderRadius: 8, padding: "10px 16px", cursor: "pointer",
            width: "100%", justifyContent: "center",
          }}
        >
          <span style={{ fontSize: 18, lineHeight: 1 }}>◎</span>
          {uploading ? "adding..." : urls.length === 0 ? "add photos" : "add more"}
        </button>
      )}
    </div>
  )
}

// Compress image to max width px, returns base64 data URL
async function compressImage(file: File, maxWidth: number): Promise<string> {
  return new Promise(resolve => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const scale = Math.min(1, maxWidth / img.width)
      const w = Math.round(img.width * scale)
      const h = Math.round(img.height * scale)
      const canvas = document.createElement("canvas")
      canvas.width = w; canvas.height = h
      const ctx = canvas.getContext("2d")!
      ctx.drawImage(img, 0, 0, w, h)
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL("image/jpeg", 0.82))
    }
    img.src = url
  })
}

// ─── Main Modal ───────────────────────────────────────────────────────────────
export function ReviewModal({ review, currentUserId, onClose, onUpdated }: ReviewModalProps) {
  const supabase = createClient()
  const queryClient = useQueryClient()
  const isOwner = review.user_id === currentUserId

  const [editing, setEditing] = useState(false)
  const [editScore, setEditScore] = useState(review.score)
  const [editBody, setEditBody] = useState(review.note ?? review.body ?? "")
  const [editTags, setEditTags] = useState<string[]>(review.tags ?? [])
  const [editPhotos, setEditPhotos] = useState<string[]>(review.image_urls ?? [])
  const [editItemName, setEditItemName] = useState(review.item_name ?? "")

  const { mutate: save, isPending } = useMutation({
    mutationFn: () => updateReview(supabase as any, {
      review_id: review.id,
      updates: {
        item_name: editItemName.trim() || null,
        score: Math.round(editScore * 10) / 10,
        note: editBody.trim() || null,
        tags: editTags,
        image_urls: editPhotos,
      },
    }),
    onSuccess: (updated: any) => {
      queryClient.invalidateQueries({ queryKey: ["feed"] })
      queryClient.invalidateQueries({ queryKey: ["reviews"] })
      setEditing(false)
      onUpdated?.({ ...review, ...updated })
    },
  })

  const toggleTag = (t: string) =>
    setEditTags(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])

  const name = review.profile?.display_name ?? review.profile?.username ?? "someone"

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)",
          zIndex: 400, backdropFilter: "blur(2px)",
        }}
      />

      {/* Sheet — slides up from bottom */}
      <div style={{
        position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)",
        width: "100%", maxWidth: 430,
        background: "#fafaf8",
        borderRadius: "20px 20px 0 0",
        zIndex: 401,
        maxHeight: "90vh",
        overflowY: "auto",
        paddingBottom: 40,
      }}>
        {/* Pull bar */}
        <div style={{ display: "flex", justifyContent: "center", padding: "14px 0 8px" }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: "#e8e8e4" }} />
        </div>

        <div style={{ padding: "0 24px" }}>
          {/* Header row */}
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
            <div>
              <p style={{ fontFamily: "'Caveat', cursive", fontSize: 14, color: "#888", margin: "0 0 2px" }}>
                {name} · {timeAgo(review.created_at)}
              </p>
              <h2 style={{
                fontFamily: "'DM Serif Display', Georgia, serif",
                fontSize: 24, color: "#1a1a1a", margin: 0, fontWeight: 400, lineHeight: 1.2,
              }}>
                {review.item_name ?? "drink"}
              </h2>
              {review.place && (
                <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "#888", margin: "4px 0 0" }}>
                  {review.place.name}{review.place.city ? ` · ${review.place.city}` : ""}
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              style={{ background: "none", border: "none", cursor: "pointer", color: "#888", fontSize: 22, lineHeight: 1, padding: "0 0 0 8px", flexShrink: 0 }}
            >×</button>
          </div>

          {/* ── View mode ───────────────────────────────────────────────── */}
          {!editing ? (
            <>
              {/* Score */}
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                <StarDisplay score={review.score} size={20} />
                <span style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 28, color: "#1a1a1a" }}>
                  {review.score.toFixed(1)}
                </span>
                <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "#bbb" }}>/ 10</span>
              </div>

              {/* Photos */}
              <PhotoGrid urls={review.image_urls ?? []} />

              {/* Body */}
              {(review.note ?? review.body) && (
                <p style={{
                  fontFamily: "'Caveat', cursive", fontSize: 18, color: "#333",
                  lineHeight: 1.55, margin: "0 0 16px",
                  borderLeft: "2px solid #e8f4ee", paddingLeft: 12,
                }}>
                  {review.note ?? review.body}
                </p>
              )}

              {/* Tags */}
              {(review.tags ?? []).length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
                  {review.tags.map(t => (
                    <span key={t} style={{
                      fontFamily: "'DM Sans', sans-serif", fontSize: 11,
                      background: "#e8f4ee", color: "#2d6a4f",
                      padding: "3px 10px", borderRadius: 10,
                    }}>{t}</span>
                  ))}
                </div>
              )}

              {/* Edit button (owner only) */}
              {isOwner && (
                <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                  <button
                    onClick={() => setEditing(true)}
                    style={{
                      flex: 1, fontFamily: "'DM Sans', sans-serif", fontSize: 14,
                      background: "#1a1a1a", color: "#fff",
                      border: "none", borderRadius: 10, padding: "12px",
                      cursor: "pointer",
                    }}
                  >
                    edit review
                  </button>
                  <button
                    onClick={() => { setEditing(true) }}
                    style={{
                      fontFamily: "'DM Sans', sans-serif", fontSize: 14,
                      background: "#e8f4ee", color: "#2d6a4f",
                      border: "none", borderRadius: 10, padding: "12px 16px",
                      cursor: "pointer",
                    }}
                  >
                    rescore
                  </button>
                </div>
              )}
            </>
          ) : (
            /* ── Edit mode ─────────────────────────────────────────────── */
            <>
              <p style={{ fontFamily: "'Caveat', cursive", fontSize: 14, color: "#888", margin: "0 0 16px" }}>
                editing review
              </p>

              {/* Drink name */}
              <div style={{ marginBottom: 24 }}>
                <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: "#888", letterSpacing: "0.08em", textTransform: "uppercase", margin: "0 0 10px" }}>
                  drink name
                </p>
                <input
                  type="text"
                  value={editItemName}
                  onChange={e => setEditItemName(e.target.value)}
                  placeholder="e.g. Matcha Latte, Milk Tea..."
                  style={{
                    width: "100%", fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 18,
                    border: "1px solid #e8e8e4", borderRadius: 10,
                    padding: "12px 16px", background: "transparent",
                    color: "#1a1a1a", outline: "none",
                  }}
                />
              </div>

              {/* Score slider */}
              <div style={{ marginBottom: 24 }}>
                <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: "#888", letterSpacing: "0.08em", textTransform: "uppercase", margin: "0 0 10px" }}>
                  score
                </p>
                <StarSlider value={editScore} onChange={setEditScore} />
              </div>

              {/* Photos */}
              <div style={{ marginBottom: 20 }}>
                <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: "#888", letterSpacing: "0.08em", textTransform: "uppercase", margin: "0 0 10px" }}>
                  photos
                </p>
                <PhotoPicker urls={editPhotos} onChange={setEditPhotos} />
              </div>

              {/* Tags */}
              <div style={{ marginBottom: 20 }}>
                <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: "#888", letterSpacing: "0.08em", textTransform: "uppercase", margin: "0 0 10px" }}>
                  descriptors
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {DESCRIPTORS.map(d => (
                    <button
                      key={d}
                      onClick={() => toggleTag(d)}
                      style={{
                        fontFamily: "'DM Sans', sans-serif", fontSize: 12,
                        padding: "6px 14px", borderRadius: 20,
                        border: `1px solid ${editTags.includes(d) ? "#2d6a4f" : "#e8e8e4"}`,
                        background: editTags.includes(d) ? "#e8f4ee" : "transparent",
                        color: editTags.includes(d) ? "#2d6a4f" : "#888",
                        cursor: "pointer",
                      }}
                    >{d}</button>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div style={{ marginBottom: 24 }}>
                <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: "#888", letterSpacing: "0.08em", textTransform: "uppercase", margin: "0 0 10px" }}>
                  notes
                </p>
                <textarea
                  value={editBody}
                  onChange={e => setEditBody(e.target.value)}
                  placeholder="your thoughts..."
                  style={{
                    width: "100%", fontFamily: "'Caveat', cursive", fontSize: 16,
                    border: "1px solid #e8e8e4", borderRadius: 10,
                    padding: "12px", background: "transparent",
                    color: "#1a1a1a", outline: "none",
                    resize: "none", height: 90,
                  }}
                />
              </div>

              {/* Actions */}
              <div style={{ display: "flex", gap: 10 }}>
                <button
                  onClick={() => setEditing(false)}
                  style={{
                    flex: 1, fontFamily: "'DM Sans', sans-serif", fontSize: 14,
                    background: "none", border: "1px solid #e8e8e4",
                    borderRadius: 10, padding: "12px", cursor: "pointer", color: "#888",
                  }}
                >
                  cancel
                </button>
                <button
                  onClick={() => save()}
                  disabled={isPending}
                  style={{
                    flex: 2, fontFamily: "'DM Sans', sans-serif", fontSize: 14,
                    background: "#2d6a4f", color: "#fff",
                    border: "none", borderRadius: 10, padding: "12px",
                    cursor: "pointer", opacity: isPending ? 0.6 : 1,
                  }}
                >
                  {isPending ? "saving..." : "save changes"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  )
}