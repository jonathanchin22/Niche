"use client"

import { useState, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { useMutation } from "@tanstack/react-query"
import { createClient } from "@niche/auth/client"
import { upsertPlace, createReview, searchExternalPlaces } from "@niche/database"

// ─── Types ────────────────────────────────────────────────────────────────────

type Step = "place" | "what" | "how" | "rate" | "context" | "done"

interface SelectedPlace {
  name: string
  address: string
  city?: string
  state?: string
  foursquare_id: string | null
  latitude: number
  longitude: number
}

type DrinkType =
  | "milk tea" | "fruit tea" | "matcha" | "taro"
  | "brown sugar" | "cheese foam" | "yakult" | "smoothie" | "seasonal special"

type SugarLevel = 0 | 25 | 50 | 75 | 100
type IceLevel = "no ice" | "less" | "regular" | "extra"
type PearlTexture = "perfect chew" | "too soft" | "too hard" | "overcooked"
type TeaBase = "real tea" | "powdery" | "artificial"
type Topping =
  | "classic boba" | "tiger pearls" | "popping boba" | "lychee jelly"
  | "grass jelly" | "pudding" | "red bean" | "aloe vera" | "coconut jelly" | "no topping"

// ─── Constants ────────────────────────────────────────────────────────────────

const DRINK_TYPES: { value: DrinkType; emoji: string; label: string }[] = [
  { value: "milk tea",       emoji: "🥛", label: "milk tea" },
  { value: "fruit tea",      emoji: "🍊", label: "fruit tea" },
  { value: "taro",           emoji: "💜", label: "taro" },
  { value: "matcha",         emoji: "🍵", label: "matcha" },
  { value: "brown sugar",    emoji: "🐯", label: "brown sugar" },
  { value: "cheese foam",    emoji: "🧀", label: "cheese foam" },
  { value: "yakult",         emoji: "🍶", label: "yakult" },
  { value: "smoothie",       emoji: "🥤", label: "smoothie" },
  { value: "seasonal special", emoji: "✨", label: "seasonal" },
]

const TOPPINGS: { value: Topping; emoji: string }[] = [
  { value: "classic boba",  emoji: "⚫" },
  { value: "tiger pearls",  emoji: "🟤" },
  { value: "popping boba",  emoji: "🫧" },
  { value: "lychee jelly",  emoji: "🌸" },
  { value: "grass jelly",   emoji: "🖤" },
  { value: "pudding",       emoji: "🟡" },
  { value: "red bean",      emoji: "🔴" },
  { value: "aloe vera",     emoji: "💚" },
  { value: "coconut jelly", emoji: "🤍" },
  { value: "no topping",    emoji: "∅"  },
]

const SUGAR_LEVELS: SugarLevel[] = [0, 25, 50, 75, 100]
const ICE_LEVELS: { value: IceLevel; label: string }[] = [
  { value: "no ice",  label: "none" },
  { value: "less",    label: "less" },
  { value: "regular", label: "regular" },
  { value: "extra",   label: "extra" },
]

const PEARL_TEXTURES: { value: PearlTexture; label: string; emoji: string }[] = [
  { value: "perfect chew", label: "perfect chew", emoji: "✓" },
  { value: "too soft",     label: "too soft",     emoji: "~" },
  { value: "too hard",     label: "too hard",     emoji: "!" },
  { value: "overcooked",   label: "overcooked",   emoji: "✗" },
]

const TEA_BASE_OPTIONS: { value: TeaBase; label: string; desc: string }[] = [
  { value: "real tea",   label: "real tea",   desc: "brewed fresh" },
  { value: "powdery",    label: "powdery",    desc: "powder base" },
  { value: "artificial", label: "artificial", desc: "artificial flavour" },
]

const VIBE_TAGS = [
  "authentic taiwanese", "seasonal menu", "long wait worth it",
  "consistent", "cute packaging", "premium ingredients",
  "quick service", "all-you-can-add toppings", "hidden gem",
  "late night", "great value", "instagrammable",
]

const VISIT_CONTEXTS = [
  { value: "solo",     label: "solo sip",    emoji: "🧍" },
  { value: "date",     label: "date",        emoji: "💑" },
  { value: "group",    label: "with friends", emoji: "👥" },
  { value: "takeout",  label: "takeout",     emoji: "🛍" },
  { value: "delivery", label: "delivery",    emoji: "🛵" },
]

// ─── Place search ─────────────────────────────────────────────────────────────

async function searchPlacesAPI(query: string): Promise<SelectedPlace[]> {
  const results = await searchExternalPlaces(query, "boba")
  return results.map(r => ({
    name: r.name,
    address: r.address,
    city: r.city,
    state: r.state,
    foursquare_id: r.foursquare_id,
    latitude: r.lat,
    longitude: r.lng,
  }))
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function LogPage() {
  const router = useRouter()
  const supabase = createClient()
  const [step, setStep] = useState<Step>("place")
  const [placeQuery, setPlaceQuery] = useState("")
  const [placeResults, setPlaceResults] = useState<SelectedPlace[]>([])
  const [selectedPlace, setSelectedPlace] = useState<SelectedPlace | null>(null)
  const [drinkType, setDrinkType] = useState<DrinkType | null>(null)
  const [sugarLevel, setSugarLevel] = useState<SugarLevel | null>(null)
  const [iceLevel, setIceLevel] = useState<IceLevel | null>(null)
  const [pearlTexture, setPearlTexture] = useState<PearlTexture | null>(null)
  const [teaBase, setTeaBase] = useState<TeaBase | null>(null)
  const [selectedToppings, setSelectedToppings] = useState<Topping[]>([])
  const [customizations, setCustomizations] = useState<string[]>([])
  const [rating, setRating] = useState(0)
  const [qualitySignals, setQualitySignals] = useState({ pearls: 0, tea_base: 0, sweetness_accuracy: 0 })
  const [visitContext, setVisitContext] = useState<string | null>(null)
  const [revisitIntent, setRevisitIntent] = useState<boolean | null>(null)
  const [pricePaid, setPricePaid] = useState<number | null>(null)
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [note, setNote] = useState("")
  const [isSearching, setIsSearching] = useState(false)
  const searchTimeout = useRef<ReturnType<typeof setTimeout>>()

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

  const toggleTopping = (topping: Topping) => {
    setSelectedToppings(prev =>
      prev.includes(topping)
        ? prev.filter(t => t !== topping)
        : [...prev, topping]
    )
  }

  const toggleTag = (tag: string) => {
    setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])
  }

  const { mutate: submitReview, isPending } = useMutation({
    mutationFn: async () => {
      if (!selectedPlace || !drinkType) throw new Error("Missing required fields")
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")

      const place = await upsertPlace(supabase as any, {
        app_id: "boba", name: selectedPlace.name, address: selectedPlace.address,
        city: selectedPlace.city ?? "", state: selectedPlace.state ?? "",
        country: "US", google_place_id: null,
        foursquare_id: selectedPlace.foursquare_id,
        lat: selectedPlace.latitude, lng: selectedPlace.longitude,
      } as any)

      const tasteAttributes = sugarLevel !== null || iceLevel !== null || pearlTexture !== null || teaBase !== null ? {
        drink_type: drinkType,
        sugar_level: sugarLevel,
        ice_level: iceLevel,
        pearl_texture: pearlTexture,
        tea_base: teaBase,
      } : null

      const qualitySignalsData = qualitySignals.pearls || qualitySignals.tea_base || qualitySignals.sweetness_accuracy ? qualitySignals : null

      await createReview(supabase as any, {
        app_id: "boba", user_id: user.id, place_id: place.id,
        score: rating,
        category: drinkType,
        item_name: null,
        note: note.trim() || null,
        tags: selectedTags,
        image_urls: [],
        taste_attributes: tasteAttributes,
        customizations,
        toppings: selectedToppings,
        quality_signals: qualitySignalsData,
        visit_context: visitContext,
        revisit_intent: revisitIntent,
        price_paid: pricePaid,
      } as any)
    },
    onSuccess: () => { setStep("done"); setTimeout(() => router.push("/"), 1800) },
  })

  const stepIndex = { place: 0, what: 1, how: 2, rate: 3, context: 4, done: 5 }[step]

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
        <p style={{ fontFamily: "var(--font-hand)", fontSize: 17, color: "#888", margin: 0 }}>taking you back...</p>
      </div>
    )
  }

  return (
    <div style={{ minHeight: "100vh", background: "#fafaf8" }}>

      <div style={{ padding: "16px 28px 0" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <button onClick={() => router.back()} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "#888", padding: 0 }}>← cancel</button>
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 32 }}>
          {[0,1,2,3,4].map(n => (
            <div key={n} style={{ height: 2, flex: 1, borderRadius: 2, background: n <= stepIndex ? "#2d6a4f" : "#e8e8e4", transition: "background 0.3s" }} />
          ))}
        </div>
      </div>

      <div style={{ padding: "0 28px 100px" }}>

        {step === "place" && (
          <div>
            <p style={{ fontFamily: "var(--font-hand)", fontSize: 15, color: "#888", margin: "0 0 4px" }}>step one</p>
            <h2 style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 28, color: "#1a1a1a", fontWeight: 400, margin: "0 0 32px" }}>where did you go?</h2>
            <div style={{ marginBottom: 8 }}>
              <label style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: "#888", letterSpacing: "0.08em", textTransform: "uppercase", display: "block", marginBottom: 4 }}>shop</label>
              <input value={placeQuery} onChange={e => handlePlaceSearch(e.target.value)} placeholder="e.g. Teaspoon Mission" style={{ width: "100%", fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 18, border: "none", borderBottom: "1.5px solid #e8e8e4", padding: "10px 0", background: "transparent", color: "#1a1a1a", outline: "none" }} />
            </div>
            {isSearching && <p style={{ fontFamily: "var(--font-hand)", fontSize: 14, color: "#bbb", margin: "8px 0" }}>searching...</p>}
            {placeResults.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
                {placeResults.map((p, i) => (
                  <button key={i} onClick={() => { setSelectedPlace(p); setPlaceQuery(p.name) }}
                    style={{ background: selectedPlace?.foursquare_id === p.foursquare_id && p.foursquare_id ? "#e8f4ee" : selectedPlace?.name === p.name && !p.foursquare_id ? "#e8f4ee" : "white", border: `1px solid ${selectedPlace?.name === p.name ? "#2d6a4f" : "#e8e8e4"}`, borderRadius: 8, padding: "12px 16px", textAlign: "left", cursor: "pointer" }}>
                    <p style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 15, margin: "0 0 2px", color: "#1a1a1a" }}>{p.name}</p>
                    <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: "#888", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.address}</p>
                  </button>
                ))}
              </div>
            )}
            {placeQuery.length > 1 && placeResults.length === 0 && !isSearching && (
              <button onClick={() => setSelectedPlace({ name: placeQuery, address: "", foursquare_id: null, latitude: 0, longitude: 0 })}
                style={{ marginTop: 12, background: "none", border: "1px dashed #e8e8e4", borderRadius: 8, padding: "12px 16px", textAlign: "left", cursor: "pointer", width: "100%" }}>
                <p style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 15, color: "#2d6a4f", margin: 0 }}>+ add "{placeQuery}"</p>
              </button>
            )}
            <button onClick={() => setStep("what")} disabled={!selectedPlace}
              style={{ marginTop: 32, width: "100%", background: "#2d6a4f", color: "#fff", border: "none", borderRadius: 10, padding: "16px", fontFamily: "'DM Sans', sans-serif", fontSize: 15, cursor: "pointer", opacity: !selectedPlace ? 0.4 : 1 }}>
              next →
            </button>
          </div>
        )}

        {step === "what" && (
          <div>
            <p style={{ fontFamily: "var(--font-hand)", fontSize: 15, color: "#888", margin: "0 0 4px" }}>step two</p>
            <h2 style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 28, color: "#1a1a1a", fontWeight: 400, margin: "0 0 32px" }}>what did you drink?</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 32 }}>
              {DRINK_TYPES.map(dt => (
                <button key={dt.value} onClick={() => setDrinkType(dt.value)}
                  style={{ aspectRatio: "1", background: drinkType === dt.value ? "#e8f4ee" : "white", border: `1px solid ${drinkType === dt.value ? "#2d6a4f" : "#e8e8e4"}`, borderRadius: 12, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, cursor: "pointer", padding: 16 }}>
                  <span style={{ fontSize: 24 }}>{dt.emoji}</span>
                  <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: drinkType === dt.value ? "#2d6a4f" : "#888" }}>{dt.label}</span>
                </button>
              ))}
            </div>
            <div style={{ display: "flex", gap: 12 }}>
              <button onClick={() => setStep("place")} style={{ flex: 1, background: "none", border: "1px solid #e8e8e4", borderRadius: 10, padding: "14px", fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: "#888", cursor: "pointer" }}>← back</button>
              <button onClick={() => setStep("how")} disabled={!drinkType}
                style={{ flex: 2, background: "#2d6a4f", color: "#fff", border: "none", borderRadius: 10, padding: "14px", fontFamily: "'DM Sans', sans-serif", fontSize: 15, cursor: "pointer", opacity: !drinkType ? 0.4 : 1 }}>
                next →
              </button>
            </div>
          </div>
        )}

        {step === "how" && (
          <div>
            <p style={{ fontFamily: "var(--font-hand)", fontSize: 15, color: "#888", margin: "0 0 4px" }}>step three</p>
            <h2 style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 28, color: "#1a1a1a", fontWeight: 400, margin: "0 0 32px" }}>how was it made?</h2>

            <div style={{ marginBottom: 24 }}>
              <label style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: "#888", letterSpacing: "0.08em", textTransform: "uppercase", display: "block", marginBottom: 8 }}>sugar level</label>
              <div style={{ display: "flex", gap: 8 }}>
                {SUGAR_LEVELS.map(level => (
                  <button key={level} onClick={() => setSugarLevel(level)}
                    style={{ flex: 1, background: sugarLevel === level ? "#e8f4ee" : "white", border: `1px solid ${sugarLevel === level ? "#2d6a4f" : "#e8e8e4"}`, borderRadius: 8, padding: "12px", fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: sugarLevel === level ? "#2d6a4f" : "#888", cursor: "pointer" }}>
                    {level}%
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: "#888", letterSpacing: "0.08em", textTransform: "uppercase", display: "block", marginBottom: 8 }}>ice level</label>
              <div style={{ display: "flex", gap: 8 }}>
                {ICE_LEVELS.map(il => (
                  <button key={il.value} onClick={() => setIceLevel(il.value)}
                    style={{ flex: 1, background: iceLevel === il.value ? "#e8f4ee" : "white", border: `1px solid ${iceLevel === il.value ? "#2d6a4f" : "#e8e8e4"}`, borderRadius: 8, padding: "12px", fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: iceLevel === il.value ? "#2d6a4f" : "#888", cursor: "pointer" }}>
                    {il.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: "#888", letterSpacing: "0.08em", textTransform: "uppercase", display: "block", marginBottom: 8 }}>pearls</label>
              <div style={{ display: "flex", gap: 8 }}>
                {PEARL_TEXTURES.map(pt => (
                  <button key={pt.value} onClick={() => setPearlTexture(pt.value)}
                    style={{ flex: 1, background: pearlTexture === pt.value ? "#e8f4ee" : "white", border: `1px solid ${pearlTexture === pt.value ? "#2d6a4f" : "#e8e8e4"}`, borderRadius: 8, padding: "12px", fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: pearlTexture === pt.value ? "#2d6a4f" : "#888", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                    <span style={{ fontSize: 16 }}>{pt.emoji}</span>
                    <span>{pt.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: "#888", letterSpacing: "0.08em", textTransform: "uppercase", display: "block", marginBottom: 8 }}>tea base</label>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {TEA_BASE_OPTIONS.map(tb => (
                  <button key={tb.value} onClick={() => setTeaBase(tb.value)}
                    style={{ background: teaBase === tb.value ? "#e8f4ee" : "white", border: `1px solid ${teaBase === tb.value ? "#2d6a4f" : "#e8e8e4"}`, borderRadius: 8, padding: "12px", textAlign: "left", cursor: "pointer" }}>
                    <div style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 15, color: teaBase === tb.value ? "#2d6a4f" : "#1a1a1a", marginBottom: 2 }}>{tb.label}</div>
                    <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "#888" }}>{tb.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 32 }}>
              <label style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: "#888", letterSpacing: "0.08em", textTransform: "uppercase", display: "block", marginBottom: 8 }}>toppings</label>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8 }}>
                {TOPPINGS.map(t => (
                  <button key={t.value} onClick={() => toggleTopping(t.value)}
                    style={{ aspectRatio: "1", background: selectedToppings.includes(t.value) ? "#e8f4ee" : "white", border: `1px solid ${selectedToppings.includes(t.value) ? "#2d6a4f" : "#e8e8e4"}`, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 20 }}>
                    {t.emoji}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", gap: 12 }}>
              <button onClick={() => setStep("what")} style={{ flex: 1, background: "none", border: "1px solid #e8e8e4", borderRadius: 10, padding: "14px", fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: "#888", cursor: "pointer" }}>← back</button>
              <button onClick={() => setStep("rate")}
                style={{ flex: 2, background: "#2d6a4f", color: "#fff", border: "none", borderRadius: 10, padding: "14px", fontFamily: "'DM Sans', sans-serif", fontSize: 15, cursor: "pointer" }}>
                next →
              </button>
            </div>
          </div>
        )}

        {step === "rate" && (
          <div>
            <p style={{ fontFamily: "var(--font-hand)", fontSize: 15, color: "#888", margin: "0 0 4px" }}>step four</p>
            <h2 style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 28, color: "#1a1a1a", fontWeight: 400, margin: "0 0 8px" }}>how was it?</h2>
            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "#888", margin: "0 0 28px" }}>slide to rate 0.0 – 5.0</p>
            <div style={{ marginBottom: 32 }}>
              <style>{`
                .rs{-webkit-appearance:none;appearance:none;width:100%;height:4px;border-radius:4px;outline:none;cursor:pointer;}
                .rs::-webkit-slider-thumb{-webkit-appearance:none;width:22px;height:22px;border-radius:50%;background:#fff;border:2px solid #c9a84c;box-shadow:0 1px 4px rgba(0,0,0,.15);cursor:pointer;}
                .rs::-moz-range-thumb{width:22px;height:22px;border-radius:50%;background:#fff;border:2px solid #c9a84c;cursor:pointer;}
              `}</style>
              <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
                <div style={{ display: "flex", gap: 2, alignItems: "center" }}>
                  {[0, 1, 2, 3, 4].map(i => {
                    const fill = Math.max(0, Math.min(1, rating / 5 - i))
                    const offset = `${Math.max(0, Math.min(100, fill * 100))}%`
                    const gradId = `sg-${i}-${Math.round(rating * 10)}`
                    return (
                      <svg key={i} width="26" height="26" viewBox="0 0 24 24">
                        <defs>
                          <linearGradient id={gradId}>
                            <stop offset={offset} stopColor="#c9a84c" />
                            <stop offset={offset} stopColor="#e8e8e4" />
                          </linearGradient>
                        </defs>
                        <path
                          d="M12 2l2.9 6 6.6 .9-4.8 4.6 1.2 6.5L12 17l-5.9 3 1.2-6.5L2.5 9l6.6-.9z"
                          fill={`url(#${gradId})`}
                        />
                      </svg>
                    )
                  })}
                </div>
                <span style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 32, color: "#1a1a1a", fontWeight: 400, minWidth: 52 }}>
                  {rating.toFixed(1)}
                </span>
                <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: "#bbb" }}>/ 5</span>
              </div>
              <input
                type="range"
                className="rs"
                min={0} max={5} step={0.1}
                value={rating}
                onChange={e => setRating(parseFloat(e.target.value))}
                style={{ background: `linear-gradient(to right, #c9a84c ${rating * 20}%, #e8e8e4 ${rating * 20}%)` }}
              />
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
                {["0","1","2","3","4","5"].map(n => (
                  <span key={n} style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 9, color: "#ddd" }}>{n}</span>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: "#888", letterSpacing: "0.08em", textTransform: "uppercase", display: "block", marginBottom: 8 }}>quality check</label>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "#666" }}>pearls</span>
                    <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "#c9a84c" }}>{qualitySignals.pearls || "—"}</span>
                  </div>
                  <input type="range" min={1} max={5} value={qualitySignals.pearls || 3} onChange={e => setQualitySignals(prev => ({ ...prev, pearls: parseInt(e.target.value) }))} style={{ width: "100%" }} />
                </div>
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "#666" }}>tea base</span>
                    <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "#c9a84c" }}>{qualitySignals.tea_base || "—"}</span>
                  </div>
                  <input type="range" min={1} max={5} value={qualitySignals.tea_base || 3} onChange={e => setQualitySignals(prev => ({ ...prev, tea_base: parseInt(e.target.value) }))} style={{ width: "100%" }} />
                </div>
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "#666" }}>sweetness accuracy</span>
                    <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "#c9a84c" }}>{qualitySignals.sweetness_accuracy || "—"}</span>
                  </div>
                  <input type="range" min={1} max={5} value={qualitySignals.sweetness_accuracy || 3} onChange={e => setQualitySignals(prev => ({ ...prev, sweetness_accuracy: parseInt(e.target.value) }))} style={{ width: "100%" }} />
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 12 }}>
              <button onClick={() => setStep("how")} style={{ flex: 1, background: "none", border: "1px solid #e8e8e4", borderRadius: 10, padding: "14px", fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: "#888", cursor: "pointer" }}>← back</button>
              <button onClick={() => setStep("context")}
                style={{ flex: 2, background: "#2d6a4f", color: "#fff", border: "none", borderRadius: 10, padding: "14px", fontFamily: "'DM Sans', sans-serif", fontSize: 15, cursor: "pointer" }}>
                next →
              </button>
            </div>
          </div>
        )}

        {step === "context" && (
          <div>
            <p style={{ fontFamily: "var(--font-hand)", fontSize: 15, color: "#888", margin: "0 0 4px" }}>step five</p>
            <h2 style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 28, color: "#1a1a1a", fontWeight: 400, margin: "0 0 32px" }}>context & vibes</h2>

            <div style={{ marginBottom: 24 }}>
              <label style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: "#888", letterSpacing: "0.08em", textTransform: "uppercase", display: "block", marginBottom: 8 }}>how did you enjoy it?</label>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
                {VISIT_CONTEXTS.map(vc => (
                  <button key={vc.value} onClick={() => setVisitContext(vc.value)}
                    style={{ background: visitContext === vc.value ? "#e8f4ee" : "white", border: `1px solid ${visitContext === vc.value ? "#2d6a4f" : "#e8e8e4"}`, borderRadius: 8, padding: "12px", display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                    <span style={{ fontSize: 18 }}>{vc.emoji}</span>
                    <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: visitContext === vc.value ? "#2d6a4f" : "#888" }}>{vc.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: "#888", letterSpacing: "0.08em", textTransform: "uppercase", display: "block", marginBottom: 8 }}>would you go back?</label>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => setRevisitIntent(true)}
                  style={{ flex: 1, background: revisitIntent === true ? "#e8f4ee" : "white", border: `1px solid ${revisitIntent === true ? "#2d6a4f" : "#e8e8e4"}`, borderRadius: 8, padding: "12px", fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: revisitIntent === true ? "#2d6a4f" : "#888", cursor: "pointer" }}>
                  yes
                </button>
                <button onClick={() => setRevisitIntent(false)}
                  style={{ flex: 1, background: revisitIntent === false ? "#f4f4f0" : "white", border: `1px solid ${revisitIntent === false ? "#888" : "#e8e8e4"}`, borderRadius: 8, padding: "12px", fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: revisitIntent === false ? "#888" : "#888", cursor: "pointer" }}>
                  no
                </button>
              </div>
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: "#888", letterSpacing: "0.08em", textTransform: "uppercase", display: "block", marginBottom: 8 }}>price paid (optional)</label>
              <input type="number" step="0.01" placeholder="6.50" value={pricePaid || ""} onChange={e => setPricePaid(parseFloat(e.target.value) || null)} style={{ width: "100%", fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 18, border: "none", borderBottom: "1.5px solid #e8e8e4", padding: "10px 0", background: "transparent", color: "#1a1a1a", outline: "none" }} />
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: "#888", letterSpacing: "0.08em", textTransform: "uppercase", display: "block", marginBottom: 8 }}>vibes</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {VIBE_TAGS.map(tag => (
                  <button key={tag} onClick={() => toggleTag(tag)}
                    style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, padding: "6px 14px", borderRadius: 20, border: `1px solid ${selectedTags.includes(tag) ? "#2d6a4f" : "#e8e8e4"}`, background: selectedTags.includes(tag) ? "#e8f4ee" : "transparent", color: selectedTags.includes(tag) ? "#2d6a4f" : "#888", cursor: "pointer" }}>
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 28 }}>
              <label style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: "#888", letterSpacing: "0.08em", textTransform: "uppercase", display: "block", marginBottom: 4 }}>notes</label>
              <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="anything else worth noting..."
                style={{ width: "100%", fontFamily: "var(--font-hand)", fontSize: 17, border: "1px solid #e8e8e4", borderRadius: 10, padding: "14px", background: "transparent", color: "#1a1a1a", outline: "none", resize: "none", height: 80 }} />
            </div>

            <div style={{ display: "flex", gap: 12 }}>
              <button onClick={() => setStep("rate")} style={{ flex: 1, background: "none", border: "1px solid #e8e8e4", borderRadius: 10, padding: "14px", fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: "#888", cursor: "pointer" }}>← back</button>
              <button onClick={() => submitReview()} disabled={isPending}
                style={{ flex: 2, background: "#2d6a4f", color: "#fff", border: "none", borderRadius: 10, padding: "14px", fontFamily: "'DM Sans', sans-serif", fontSize: 15, cursor: "pointer", opacity: isPending ? 0.6 : 1 }}>
                {isPending ? "saving..." : "log + share"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}