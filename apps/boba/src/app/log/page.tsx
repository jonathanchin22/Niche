"use client"

import { useState, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { useMutation } from "@tanstack/react-query"
import { createClient } from "@niche/auth/client"
import { upsertPlace, createReview } from "@niche/database"

type Step = "drink" | "rate" | "share" | "done"

interface SelectedPlace {
  name: string
  address: string
  city?: string
  state?: string
  google_place_id: string
  latitude: number
  longitude: number
}

const DESCRIPTORS = [
  "creamy", "sweet", "earthy", "fruity", "bold", "delicate",
  "chewy pearls", "great value", "fresh", "rich", "light", "classic",
]

async function compressImage(file: File, maxWidth = 800): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const scale = Math.min(1, maxWidth / img.width)
      const w = Math.round(img.width * scale)
      const h = Math.round(img.height * scale)
      const canvas = document.createElement("canvas")
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext("2d")
      if (!ctx) {
        URL.revokeObjectURL(url)
        reject(new Error("Could not process image"))
        return
      }
      ctx.drawImage(img, 0, 0, w, h)
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL("image/jpeg", 0.82))
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error("Failed to load image"))
    }
    img.src = url
  })
}

async function searchPlacesAPI(query: string): Promise<SelectedPlace[]> {
  if (!query || query.length < 2) return []
  const encoded = encodeURIComponent(`${query} bubble tea boba`)
  const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encoded}&format=json&limit=5&addressdetails=1`)
  if (!res.ok) return []
  const data = await res.json()
  return data.map((p: any) => ({
    name: p.name || p.display_name.split(",")[0],
    address: p.display_name,
    city: p.address?.city || p.address?.town || p.address?.village || "",
    state: p.address?.state || "",
    google_place_id: `nominatim_${p.osm_id}`,
    latitude: parseFloat(p.lat),
    longitude: parseFloat(p.lon),
  }))
}

function StarDisplay({ score }: { score: number }) {
  const scoreNum = Number(score)
  const pct = Number.isFinite(scoreNum) ? Math.max(0, Math.min(1, scoreNum / 10)) : 0
  return (
    <div style={{ display: "flex", gap: 3 }}>
      {[0, 1, 2, 3, 4].map(i => {
        const fill = Number.isFinite(pct) ? Math.max(0, Math.min(1, pct * 5 - i)) : 0
        const offset = `${Math.max(0, Math.min(100, fill * 100))}%`
        const gradId = `sg-${i}-${Math.round(scoreNum * 10)}`
        return (
          <svg key={i} width="26" height="26" viewBox="0 0 24 24">
            <defs>
              <linearGradient id={gradId}>
                <stop offset={offset} stopColor="#c9a84c" />
                <stop offset={offset} stopColor="#e8e8e4" />
              </linearGradient>
            </defs>
            <path
              d="M12 2l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17l-5.9 3 1.2-6.5L2.5 9l6.6-.9z"
              fill={`url(#${gradId})`}
            />
          </svg>
        )
      })}
    </div>
  )
}

function StarSlider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const label = value === 0 ? "—" : value.toFixed(1)
  return (
    <div>
      <style>{`
        .rs{-webkit-appearance:none;appearance:none;width:100%;height:4px;border-radius:4px;outline:none;cursor:pointer;}
        .rs::-webkit-slider-thumb{-webkit-appearance:none;width:22px;height:22px;border-radius:50%;background:#fff;border:2px solid #c9a84c;box-shadow:0 1px 4px rgba(0,0,0,.15);cursor:pointer;}
        .rs::-moz-range-thumb{width:22px;height:22px;border-radius:50%;background:#fff;border:2px solid #c9a84c;cursor:pointer;}
      `}</style>
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
        <StarDisplay score={value} />
        <span style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 32, color: "#1a1a1a", fontWeight: 400, minWidth: 52 }}>
          {label}
        </span>
        <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: "#bbb" }}>/ 10</span>
      </div>
      <input
        type="range"
        className="rs"
        min={0} max={10} step={0.1}
        value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        style={{ background: `linear-gradient(to right, #c9a84c ${value * 10}%, #e8e8e4 ${value * 10}%)` }}
      />
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
        {["0","1","2","3","4","5","6","7","8","9","10"].map(n => (
          <span key={n} style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 9, color: "#ddd" }}>{n}</span>
        ))}
      </div>
    </div>
  )
}

const inputStyle = { width: "100%", fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 18, border: "none", borderBottom: "1.5px solid #e8e8e4", padding: "10px 0", background: "transparent", color: "#1a1a1a", outline: "none" }
const labelStyle = { fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: "#888", letterSpacing: "0.08em", textTransform: "uppercase" as const, display: "block", marginBottom: 4 }

export default function LogPage() {
  const router = useRouter()
  const supabase = createClient()
  const [step, setStep] = useState<Step>("drink")
  const [drinkName, setDrinkName] = useState("")
  const [placeQuery, setPlaceQuery] = useState("")
  const [placeResults, setPlaceResults] = useState<SelectedPlace[]>([])
  const [selectedPlace, setSelectedPlace] = useState<SelectedPlace | null>(null)
  const [rating, setRating] = useState(0)
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [body, setBody] = useState("")
  const [photoUrls, setPhotoUrls] = useState<string[]>([])
  const [photoUploading, setPhotoUploading] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const searchTimeout = useRef<ReturnType<typeof setTimeout>>()
  const photoInputRef = useRef<HTMLInputElement>(null)

  const handlePlaceSearch = useCallback((q: string) => {
    setPlaceQuery(q)
    clearTimeout(searchTimeout.current)
    if (q.length < 2) { setPlaceResults([]); return }
    setIsSearching(true)
    searchTimeout.current = setTimeout(async () => {
      const results = await searchPlacesAPI(q)
      setPlaceResults(results)
      setIsSearching(false)
    }, 400)
  }, [])

  const toggleTag = (tag: string) => {
    setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])
  }

  const { mutate: submitReview, isPending } = useMutation({
    mutationFn: async () => {
      if (!selectedPlace) throw new Error("No place selected")
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")
      const place = await upsertPlace(supabase as any, {
        app_id: "boba", name: selectedPlace.name, address: selectedPlace.address,
        city: selectedPlace.city ?? "", state: selectedPlace.state ?? "",
        country: "US", google_place_id: selectedPlace.google_place_id,
        lat: selectedPlace.latitude, lng: selectedPlace.longitude,
      } as any)
      await createReview(supabase as any, {
        app_id: "boba", user_id: user.id, place_id: place.id,
        item_name: drinkName, score: Math.round(rating * 10) / 10,
        note: body.trim() || null, tags: selectedTags, image_urls: photoUrls,
      } as any)
    },
    onSuccess: () => { setStep("done"); setTimeout(() => router.push("/"), 1800) },
  })

  const handlePhotoFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    setPhotoUploading(true)
    const newUrls: string[] = []
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) continue
      try {
        const compressed = await compressImage(file)
        newUrls.push(compressed)
      } catch {
        continue
      }
    }
    setPhotoUrls(prev => [...prev, ...newUrls].slice(0, 6))
    setPhotoUploading(false)
  }

  const stepIndex = { drink: 0, rate: 1, share: 2, done: 3 }[step]

  if (step === "done") {
    return (
      <div style={{ minHeight: "100vh", background: "#fafaf8", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: "0 28px" }}>
        <svg width="80" height="110" viewBox="0 0 120 160" fill="none" style={{ opacity: 0.7 }}>
          <path d="M35 30 L85 30 L78 140 L42 140 Z" stroke="#2d6a4f" strokeWidth="2" strokeLinecap="round" fill="none"/>
          <path d="M30 30 Q60 22 90 30" stroke="#2d6a4f" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
          <line x1="60" y1="20" x2="60" y2="-5" stroke="#2d6a4f" strokeWidth="1.5" strokeLinecap="round"/>
          <circle cx="47" cy="110" r="6" stroke="#2d6a4f" strokeWidth="1.5" fill="none"/>
          <circle cx="63" cy="118" r="6" stroke="#2d6a4f" strokeWidth="1.5" fill="none"/>
          <circle cx="75" cy="108" r="5" stroke="#2d6a4f" strokeWidth="1.5" fill="none"/>
        </svg>
        <h2 style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 28, color: "#1a1a1a", fontWeight: 400, margin: 0 }}>logged.</h2>
        <p style={{ fontFamily: "'Caveat', cursive", fontSize: 17, color: "#888", margin: 0 }}>taking you back...</p>
      </div>
    )
  }

  return (
    <div style={{ minHeight: "100vh", background: "#fafaf8" }}>

      <div style={{ padding: "16px 28px 0" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <button onClick={() => router.back()} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "#888", padding: 0 }}>← cancel</button>
        </div>
        {/* Step headers clickable for going back */}
        <div style={{ display: "flex", gap: 8, marginBottom: 32 }}>
          {["drink", "rate", "share"].map((s, n) => {
            const canGoBack = n < stepIndex;
            return (
              <div
                key={s}
                style={{
                  flex: 1,
                  height: 2,
                  borderRadius: 2,
                  background: n <= stepIndex ? "#2d6a4f" : "#e8e8e4",
                  transition: "background 0.3s",
                  cursor: canGoBack ? "pointer" : "default",
                  position: "relative",
                }}
                onClick={() => {
                  if (canGoBack) setStep(s as Step)
                }}
              >
                <span
                  style={{
                    position: "absolute",
                    top: -18,
                    left: 0,
                    right: 0,
                    textAlign: "center",
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: 11,
                    color: canGoBack ? "#2d6a4f" : "#bbb",
                    textDecoration: canGoBack ? "underline" : undefined,
                    cursor: canGoBack ? "pointer" : "default",
                    textTransform: "capitalize",
                  }}
                >
                  {s}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      <div style={{ padding: "0 28px 100px" }}>

        {step === "drink" && (
          <div>
            <p style={{ fontFamily: "'Caveat', cursive", fontSize: 15, color: "#888", margin: "0 0 4px" }}>step one</p>
            <h2 style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 28, color: "#1a1a1a", fontWeight: 400, margin: "0 0 32px" }}>what did you drink?</h2>
            <div style={{ marginBottom: 24 }}>
              <label style={labelStyle}>drink name</label>
              <input autoFocus value={drinkName} onChange={e => setDrinkName(e.target.value)} placeholder="e.g. taro milk tea" style={inputStyle} />
            </div>
            <div style={{ marginBottom: 8 }}>
              <label style={labelStyle}>shop</label>
              <input value={placeQuery} onChange={e => handlePlaceSearch(e.target.value)} placeholder="e.g. Teaspoon Mission" style={inputStyle} />
            </div>
            {isSearching && <p style={{ fontFamily: "'Caveat', cursive", fontSize: 14, color: "#bbb", margin: "8px 0" }}>searching...</p>}
            {placeResults.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
                {placeResults.map((p, i) => (
                  <button key={i} onClick={() => { setSelectedPlace(p); setPlaceQuery(p.name) }}
                    style={{ background: selectedPlace?.google_place_id === p.google_place_id ? "#e8f4ee" : "white", border: `1px solid ${selectedPlace?.google_place_id === p.google_place_id ? "#2d6a4f" : "#e8e8e4"}`, borderRadius: 8, padding: "12px 16px", textAlign: "left", cursor: "pointer" }}>
                    <p style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 15, margin: "0 0 2px", color: "#1a1a1a" }}>{p.name}</p>
                    <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: "#888", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.address}</p>
                  </button>
                ))}
              </div>
            )}
            {placeQuery.length > 1 && placeResults.length === 0 && !isSearching && (
              <button onClick={() => setSelectedPlace({ name: placeQuery, address: "", google_place_id: `manual_${Date.now()}`, latitude: 0, longitude: 0 })}
                style={{ marginTop: 12, background: "none", border: "1px dashed #e8e8e4", borderRadius: 8, padding: "12px 16px", textAlign: "left", cursor: "pointer", width: "100%" }}>
                <p style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 15, color: "#2d6a4f", margin: 0 }}>+ add "{placeQuery}"</p>
              </button>
            )}
            <button onClick={() => setStep("rate")} disabled={!drinkName || !selectedPlace}
              style={{ marginTop: 32, width: "100%", background: "#2d6a4f", color: "#fff", border: "none", borderRadius: 10, padding: "16px", fontFamily: "'DM Sans', sans-serif", fontSize: 15, cursor: "pointer", opacity: (!drinkName || !selectedPlace) ? 0.4 : 1 }}>
              next →
            </button>
          </div>
        )}

        {step === "rate" && (
          <div>
            <p style={{ fontFamily: "'Caveat', cursive", fontSize: 15, color: "#888", margin: "0 0 4px" }}>step two</p>
            <h2 style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 28, color: "#1a1a1a", fontWeight: 400, margin: "0 0 8px" }}>how was it?</h2>
            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "#888", margin: "0 0 28px" }}>slide to rate 0.0 – 10.0</p>
            <div style={{ marginBottom: 32 }}>
              <StarSlider value={rating} onChange={setRating} />
            </div>
            <p style={labelStyle}>how would you describe it?</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 28 }}>
              {DESCRIPTORS.map(d => (
                <button key={d} onClick={() => toggleTag(d)}
                  style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, padding: "6px 14px", borderRadius: 20, border: `1px solid ${selectedTags.includes(d) ? "#2d6a4f" : "#e8e8e4"}`, background: selectedTags.includes(d) ? "#e8f4ee" : "transparent", color: selectedTags.includes(d) ? "#2d6a4f" : "#888", cursor: "pointer" }}>
                  {d}
                </button>
              ))}
            </div>
            <textarea value={body} onChange={e => setBody(e.target.value)} placeholder="anything else worth noting..."
              style={{ width: "100%", fontFamily: "'Caveat', cursive", fontSize: 17, border: "1px solid #e8e8e4", borderRadius: 10, padding: "14px", background: "transparent", color: "#1a1a1a", outline: "none", resize: "none", height: 100 }} />
            <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
              <button onClick={() => setStep("drink")} style={{ flex: 1, background: "none", border: "1px solid #e8e8e4", borderRadius: 10, padding: "14px", fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: "#888", cursor: "pointer" }}>← back</button>
              <button onClick={() => setStep("share")} disabled={rating === 0}
                style={{ flex: 2, background: "#2d6a4f", color: "#fff", border: "none", borderRadius: 10, padding: "14px", fontFamily: "'DM Sans', sans-serif", fontSize: 15, cursor: "pointer", opacity: rating === 0 ? 0.4 : 1 }}>
                next →
              </button>
            </div>
          </div>
        )}

        {step === "share" && (
          <div style={{ textAlign: "center" }}>
            <p style={{ fontFamily: "'Caveat', cursive", fontSize: 15, color: "#888", margin: "0 0 4px" }}>step three</p>
            <h2 style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 28, color: "#1a1a1a", fontWeight: 400, margin: "0 0 16px" }}>share it?</h2>
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 10, marginBottom: 28 }}>
              <StarDisplay score={rating} />
              <span style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 28, color: "#1a1a1a" }}>{rating.toFixed(1)}</span>
              <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "#bbb" }}>/ 10</span>
            </div>

            <div style={{ marginBottom: 24, textAlign: "left" }}>
              <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: "#888", letterSpacing: "0.08em", textTransform: "uppercase", margin: "0 0 8px" }}>
                photos
              </p>
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                multiple
                style={{ display: "none" }}
                onChange={e => handlePhotoFiles(e.target.files)}
              />

              {photoUrls.length > 0 && (
                <div style={{
                  display: "grid",
                  gridTemplateColumns: photoUrls.length === 1 ? "1fr" : "1fr 1fr",
                  gap: 8,
                  marginBottom: 10,
                }}>
                  {photoUrls.map((url, i) => (
                    <div key={`${url.slice(0, 32)}-${i}`} style={{ position: "relative", borderRadius: 8, overflow: "hidden", aspectRatio: photoUrls.length === 1 ? "16/9" : "1/1" }}>
                      <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                      <button
                        onClick={() => setPhotoUrls(prev => prev.filter((_, idx) => idx !== i))}
                        style={{
                          position: "absolute", top: 6, right: 6,
                          border: "none", borderRadius: "50%", width: 22, height: 22,
                          background: "rgba(0,0,0,0.55)", color: "#fff", cursor: "pointer",
                          fontSize: 14, lineHeight: 1,
                        }}
                      >×</button>
                    </div>
                  ))}
                </div>
              )}

              {photoUrls.length < 6 && (
                <button
                  onClick={() => photoInputRef.current?.click()}
                  disabled={photoUploading}
                  style={{
                    width: "100%",
                    background: "#e8f4ee",
                    border: "1px dashed #2d6a4f",
                    borderRadius: 10,
                    padding: "12px",
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: 13,
                    color: "#2d6a4f",
                    cursor: "pointer",
                  }}
                >
                  {photoUploading ? "adding..." : photoUrls.length === 0 ? "add photos" : "add more"}
                </button>
              )}
            </div>

            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: "#888", marginBottom: 24 }}>let your friends see what you're sipping</p>
            <button onClick={() => submitReview()} disabled={isPending}
              style={{ width: "100%", background: "#2d6a4f", color: "#fff", border: "none", borderRadius: 10, padding: "16px", fontFamily: "'DM Sans', sans-serif", fontSize: 15, cursor: "pointer", marginBottom: 12, opacity: isPending ? 0.6 : 1 }}>
              {isPending ? "saving..." : "log + share"}
            </button>
            <button onClick={() => submitReview()} disabled={isPending}
              style={{ width: "100%", background: "none", border: "1px solid #e8e8e4", borderRadius: 10, padding: "16px", fontFamily: "'DM Sans', sans-serif", fontSize: 14, cursor: "pointer", color: "#888" }}>
              keep it private
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
