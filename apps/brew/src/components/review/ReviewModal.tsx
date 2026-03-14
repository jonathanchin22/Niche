"use client"

import { useState, useRef, useTransition } from "react"
import { createBrowserClient } from "@supabase/ssr"
import { createReview, upsertPlace } from "@niche/database"
import { Stars, Pill, MonoLabel } from "@/components/ui/Primitives"

const APP_ID = "brew" as const

const TASTING_NOTES = [
  "bright", "nutty", "chocolatey", "floral", "acidic",
  "smooth", "bold", "fruity", "clean", "syrupy",
] as const

const CATEGORIES = [
  "espresso", "pour over", "flat white", "cappuccino",
  "cortado", "cold brew", "latte", "filter", "aeropress", "matcha",
] as const

interface Props {
  userId: string
  onSuccess: () => void
  onClose: () => void
}

function getSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export default function ReviewModal({ userId, onSuccess, onClose }: Props) {
  const [step, setStep] = useState(1)
  const [drinkName, setDrinkName] = useState("")
  const [category, setCategory] = useState("")
  const [cafeName, setCafeName] = useState("")
  const [originRoast, setOriginRoast] = useState("")
  const [score, setScore] = useState(0)             // 0–10 stored, shown as 0–5 stars
  const [tags, setTags] = useState<string[]>([])
  const [note, setNote] = useState("")
  const [photos, setPhotos] = useState<(string | null)[]>([null, null, null])
  const [photoFiles, setPhotoFiles] = useState<(File | null)[]>([null, null, null])
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const refs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)]

  const toggleTag = (t: string) =>
    setTags(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])

  const handlePhoto = (i: number) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const next = [...photos]; next[i] = URL.createObjectURL(file); setPhotos(next)
    const nextF = [...photoFiles]; nextF[i] = file; setPhotoFiles(nextF)
  }

  const uploadPhoto = async (file: File): Promise<string | null> => {
    const supabase = getSupabase()
    const ext = file.name.split(".").pop()
    const path = `brew/${userId}/${Date.now()}.${ext}`
    const { error } = await supabase.storage.from("review-images").upload(path, file)
    if (error) return null
    const { data } = supabase.storage.from("review-images").getPublicUrl(path)
    return data.publicUrl
  }

  const handleSubmit = () => {
    if (!drinkName.trim()) { setError("Drink name is required."); setStep(1); return }
    if (!cafeName.trim()) { setError("Cafe name is required."); setStep(1); return }
    if (score === 0) { setError("Please set a rating."); setStep(2); return }

    startTransition(async () => {
      try {
        const supabase = getSupabase()

        // Upload photos
        const imageUrls: string[] = []
        for (const file of photoFiles) {
          if (file) {
            const url = await uploadPhoto(file)
            if (url) imageUrls.push(url)
          }
        }

        // Upsert the place
        const place = await upsertPlace(supabase, {
          app_id: APP_ID,
          name: cafeName.trim(),
          address: "",
          city: "",
          state: "",
          country: "",
          lat: 0,
          lng: 0,
          google_place_id: null,
          foursquare_id: null,
          cover_image_url: null,
        })

        // Create review — score is stored as 0–10
        await createReview(supabase, {
          app_id: APP_ID,
          user_id: userId,
          place_id: place.id,
          score,                          // already 0–10
          category: category || null,
          item_name: drinkName.trim(),
          note: note.trim() || null,
          tags,
          image_urls: imageUrls,
        })

        onSuccess()
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Something went wrong.")
      }
    })
  }

  return (
    <div style={{
      position: "fixed", inset: 0, background: "var(--c-bg)",
      zIndex: 200, overflowY: "auto", maxWidth: 430, margin: "0 auto",
    }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "52px 28px 0" }}>
        <MonoLabel>log a drink</MonoLabel>
        <button type="button" onClick={onClose} style={{
          background: "none", border: "1px solid var(--c-rule)",
          fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--c-subtle)",
          padding: "4px 12px", cursor: "pointer", letterSpacing: "0.08em",
        }}>
          ✕ cancel
        </button>
      </div>

      {/* Step indicator */}
      <div style={{ display: "flex", borderBottom: "1px solid var(--c-rule)", margin: "20px 0 0" }}>
        {["what", "how", "photos"].map((s, i) => (
          <div key={s} style={{
            flex: 1, padding: "12px 0", textAlign: "center",
            borderBottom: `2px solid ${i + 1 <= step ? "var(--c-accent)" : "transparent"}`,
          }}>
            <span style={{
              fontFamily: "var(--font-mono)", fontSize: 9,
              color: i + 1 <= step ? "var(--c-accent)" : "var(--c-subtle)",
              letterSpacing: "0.1em", textTransform: "uppercase",
            }}>
              {i + 1}. {s}
            </span>
          </div>
        ))}
      </div>

      <div style={{ padding: "32px 28px 100px" }}>
        {error && (
          <div style={{ background: "#fff0f0", border: "1px solid #f5c6c6", padding: "10px 14px", marginBottom: 20, borderRadius: 2 }}>
            <p style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "#c0392b", letterSpacing: "0.05em" }}>{error}</p>
          </div>
        )}

        {/* ── Step 1: What ── */}
        {step === 1 && (
          <>
            <h2 style={{ fontFamily: "var(--font-display)", fontSize: 40, color: "var(--c-ink)", margin: "0 0 6px", fontWeight: 400, fontStyle: "italic", lineHeight: 1.05 }}>
              what did<br />you drink?
            </h2>
            <p style={{ fontFamily: "var(--font-hand)", fontSize: 15, color: "var(--c-subtle)", margin: "0 0 32px" }}>
              every detail helps
            </p>

            {/* Category pills */}
            <div style={{ marginBottom: 24 }}>
              <MonoLabel style={{ marginBottom: 10 }}>type</MonoLabel>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {CATEGORIES.map(c => (
                  <Pill key={c} active={category === c} onClick={() => setCategory(prev => prev === c ? "" : c)}>{c}</Pill>
                ))}
              </div>
            </div>

            {[
              { label: "drink name", ph: "e.g. oat flat white", val: drinkName, set: setDrinkName },
              { label: "cafe", ph: "e.g. Sightglass SoMa", val: cafeName, set: setCafeName },
              { label: "origin / roast", ph: "e.g. Ethiopia Yirgacheffe, light", val: originRoast, set: setOriginRoast },
            ].map(({ label, ph, val, set }) => (
              <div key={label} style={{ marginBottom: 28 }}>
                <MonoLabel style={{ marginBottom: 10 }}>{label}</MonoLabel>
                <input
                  value={val}
                  onChange={e => set(e.target.value)}
                  placeholder={ph}
                  style={{
                    width: "100%", fontFamily: "var(--font-display)", fontSize: 20,
                    border: "none", borderBottom: "1px solid var(--c-rule)",
                    padding: "8px 0", background: "transparent", color: "var(--c-ink)",
                    outline: "none", fontStyle: "italic",
                  }}
                />
              </div>
            ))}

            <button type="button" onClick={() => { setError(null); setStep(2) }} style={primaryBtn}>
              next →
            </button>
          </>
        )}

        {/* ── Step 2: How ── */}
        {step === 2 && (
          <>
            <h2 style={{ fontFamily: "var(--font-display)", fontSize: 40, color: "var(--c-ink)", margin: "0 0 6px", fontWeight: 400, fontStyle: "italic", lineHeight: 1.05 }}>
              how was<br />it?
            </h2>
            <p style={{ fontFamily: "var(--font-hand)", fontSize: 15, color: "var(--c-subtle)", margin: "0 0 24px" }}>
              tasting notes welcome
            </p>

            <div style={{ marginBottom: 28 }}>
              <MonoLabel style={{ marginBottom: 12 }}>your rating</MonoLabel>
              {/* Display as 5 stars, store as 0–10 */}
              <Stars value={Math.round((score / 10) * 5)} onChange={n => setScore(Math.round((n / 5) * 10))} size={22} />
            </div>

            <div style={{ marginBottom: 28 }}>
              <MonoLabel style={{ marginBottom: 12 }}>tasting notes</MonoLabel>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {TASTING_NOTES.map(t => (
                  <Pill key={t} active={tags.includes(t)} onClick={() => toggleTag(t)}>{t}</Pill>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 28 }}>
              <MonoLabel style={{ marginBottom: 12 }}>your thoughts</MonoLabel>
              <textarea
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="what stood out..."
                style={{
                  width: "100%", fontFamily: "var(--font-display)", fontSize: 17,
                  border: "none", borderBottom: "1px solid var(--c-rule)",
                  background: "transparent", color: "var(--c-ink)", outline: "none",
                  resize: "none", height: 80, padding: "0 0 8px", fontStyle: "italic",
                }}
              />
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button type="button" onClick={() => setStep(1)} style={ghostBtn}>← back</button>
              <button type="button" onClick={() => { setError(null); setStep(3) }} style={{ ...primaryBtn, flex: 2 }}>next →</button>
            </div>
          </>
        )}

        {/* ── Step 3: Photos ── */}
        {step === 3 && (
          <>
            <h2 style={{ fontFamily: "var(--font-display)", fontSize: 40, color: "var(--c-ink)", margin: "0 0 6px", fontWeight: 400, fontStyle: "italic", lineHeight: 1.05 }}>
              add<br />photos
            </h2>
            <p style={{ fontFamily: "var(--font-hand)", fontSize: 15, color: "var(--c-subtle)", margin: "0 0 24px" }}>
              show your shot — latte art, the setup, the vibe
            </p>

            {/* Main photo */}
            <div style={{ marginBottom: 10 }}>
              <MonoLabel style={{ marginBottom: 8 }}>main shot</MonoLabel>
              <PhotoSlot src={photos[0] ?? null} inputRef={refs[0]} onChange={handlePhoto(0)} aspect="wide" label="your best shot" />
              <input ref={refs[0]} type="file" accept="image/*" style={{ display: "none" }} onChange={handlePhoto(0)} />
            </div>

            {/* Detail shots */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 28 }}>
              {[1, 2].map(i => (
                <div key={i}>
                  <PhotoSlot src={photos[i] ?? null} inputRef={refs[i]} onChange={handlePhoto(i)} label="detail shot" />
                  <input ref={refs[i]} type="file" accept="image/*" style={{ display: "none" }} onChange={handlePhoto(i)} />
                </div>
              ))}
            </div>

            <div style={{ borderLeft: "2px solid var(--c-accent)", paddingLeft: 14, marginBottom: 28 }}>
              <p style={{ fontFamily: "var(--font-display)", fontSize: 16, color: "var(--c-mid)", margin: 0, fontStyle: "italic" }}>
                Photos help friends find and trust your recommendations.
              </p>
            </div>

            <button type="button" onClick={handleSubmit} disabled={isPending} style={{ ...primaryBtn, marginBottom: 10, opacity: isPending ? 0.6 : 1 }}>
              {isPending ? "saving..." : "log + share"}
            </button>
            <button type="button" onClick={handleSubmit} disabled={isPending} style={{ ...ghostBtn, opacity: isPending ? 0.6 : 1 }}>
              skip photos
            </button>
          </>
        )}
      </div>
    </div>
  )
}

function PhotoSlot({ src, inputRef, onChange, aspect = "square", label }: {
  src: string | null
  inputRef?: React.RefObject<HTMLInputElement>
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  aspect?: "square" | "wide"
  label?: string
}) {
  return (
    <div
      onClick={() => inputRef?.current?.click()}
      style={{
        position: "relative", width: "100%",
        paddingBottom: aspect === "wide" ? "56%" : "100%",
        borderRadius: 4, overflow: "hidden",
        border: src ? "none" : "1px solid var(--c-rule)",
        background: src ? "transparent" : "var(--c-tint)",
        cursor: "pointer",
      }}
    >
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {src ? (
          <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--c-subtle)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
            + {label}
          </span>
        )}
      </div>
    </div>
  )
}

const primaryBtn: React.CSSProperties = {
  width: "100%", background: "var(--c-accent)", color: "#fff",
  border: "none", padding: "16px", fontFamily: "var(--font-mono)",
  fontSize: 11, cursor: "pointer", letterSpacing: "0.1em", textTransform: "uppercase",
}

const ghostBtn: React.CSSProperties = {
  flex: 1, width: "100%", background: "none",
  border: "1px solid var(--c-rule)", padding: "14px",
  fontFamily: "var(--font-mono)", fontSize: 10, cursor: "pointer",
  color: "var(--c-subtle)", letterSpacing: "0.08em", textTransform: "uppercase",
}
