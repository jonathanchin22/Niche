"use client"

import { useState, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { useMutation } from "@tanstack/react-query"
import { createClient } from "@niche/auth"
import { upsertPlace, createReview } from "@niche/database"
import { AppShell } from "@/components/ui/AppShell"

type Step = "place" | "score" | "details" | "done"

interface SelectedPlace {
  name: string
  address: string
  google_place_id: string
  latitude: number
  longitude: number
}

const BOBA_TAGS = [
  "classic milk tea", "fruit tea", "taro", "matcha", "brown sugar",
  "good toppings", "creamy", "not too sweet", "chewy pearls", "large portions",
  "great value", "instagrammable", "good study spot", "fast service",
]

// Simple place search using a free geocoding API — no key needed
async function searchPlacesAPI(query: string): Promise<SelectedPlace[]> {
  if (!query || query.length < 2) return []
  const encoded = encodeURIComponent(`${query} bubble tea boba`)
  const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encoded}&format=json&limit=5&addressdetails=1`)
  if (!res.ok) return []
  const data = await res.json()
  return data.map((p: any) => ({
    name: p.name || p.display_name.split(",")[0],
    address: p.display_name,
    google_place_id: `nominatim_${p.osm_id}`,
    latitude: parseFloat(p.lat),
    longitude: parseFloat(p.lon),
  }))
}

function ScoreSelector({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const labels: Record<number, string> = {
    1: "Don't bother", 2: "Disappointing", 3: "Below average", 4: "Mediocre",
    5: "It's okay", 6: "Pretty good", 7: "Solid", 8: "Really good",
    9: "Amazing", 10: "Perfect",
  }
  const color = value >= 8 ? "#059669" : value >= 6 ? "#D97706" : value >= 4 ? "#EA580C" : "#DC2626"

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="w-28 h-28 rounded-full flex items-center justify-center shadow-xl" style={{ background: color }}>
        <span className="text-5xl font-black text-white">{value}</span>
      </div>
      <p className="text-lg font-bold" style={{ color }}>{labels[value]}</p>
      <input
        type="range"
        min={1}
        max={10}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-3 rounded-full appearance-none cursor-pointer"
        style={{ accentColor: color }}
      />
      <div className="flex justify-between w-full text-xs text-gray-400 font-medium">
        <span>1</span><span>5</span><span>10</span>
      </div>
    </div>
  )
}

export default function LogPage() {
  const router = useRouter()
  const supabase = createClient()
  const [step, setStep] = useState<Step>("place")
  const [placeQuery, setPlaceQuery] = useState("")
  const [placeResults, setPlaceResults] = useState<SelectedPlace[]>([])
  const [selectedPlace, setSelectedPlace] = useState<SelectedPlace | null>(null)
  const [score, setScore] = useState(7)
  const [body, setBody] = useState("")
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const searchTimeout = useRef<ReturnType<typeof setTimeout>>()

  const handleSearch = useCallback((q: string) => {
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
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    )
  }

  const { mutate: submitReview, isPending } = useMutation({
    mutationFn: async () => {
      if (!selectedPlace) throw new Error("No place selected")
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")

      // Upsert place
      const place = await upsertPlace(supabase as any, {
        app_id: "boba",
        name: selectedPlace.name,
        address: selectedPlace.address,
        google_place_id: selectedPlace.google_place_id,
      } as any)

      // Create review
      await createReview(supabase as any, {
        app_id: "boba",
        user_id: user.id,
        place_id: place.id,
        score,
        body: body.trim() || null,
        tags: selectedTags,
        image_urls: [],
      } as any)
    },
    onSuccess: () => {
      setStep("done")
      setTimeout(() => router.push("/"), 1500)
    },
  })

  // Step: Done
  if (step === "done") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-8" style={{ background: "linear-gradient(135deg, #FAFAFE 0%, #F0EBFF 100%)" }}>
        <div className="w-20 h-20 rounded-full flex items-center justify-center text-4xl" style={{ background: "#F3EEFF" }}>
          🧋
        </div>
        <h2 className="text-2xl font-black" style={{ color: "#7C3AED" }}>Logged!</h2>
        <p className="text-gray-500 text-sm">Your review has been saved.</p>
        <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "#7C3AED", borderTopColor: "transparent" }} />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "linear-gradient(135deg, #FAFAFE 0%, #F0EBFF 100%)" }}>
      {/* Header */}
      <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-purple-100">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
          <button onClick={() => router.back()} className="text-gray-400 font-medium text-sm">Cancel</button>
          <h1 className="font-black text-lg" style={{ color: "#7C3AED" }}>Log a drink</h1>
          <div className="w-12" />
        </div>
        {/* Progress */}
        <div className="flex gap-1 px-4 pb-3">
          {(["place", "score", "details"] as Step[]).map((s, i) => (
            <div key={s} className="h-1 flex-1 rounded-full transition-all" style={{
              background: ["place", "score", "details"].indexOf(step) >= i ? "#7C3AED" : "#E5E7EB"
            }} />
          ))}
        </div>
      </div>

      <div className="flex-1 max-w-lg mx-auto w-full px-4 py-6">

        {/* Step 1: Place */}
        {step === "place" && (
          <div className="flex flex-col gap-4">
            <div>
              <h2 className="text-xl font-black mb-1" style={{ color: "#12082A" }}>Where did you go?</h2>
              <p className="text-sm" style={{ color: "#6B5B8A" }}>Search for the boba spot you visited.</p>
            </div>

            <div className="relative">
              <input
                autoFocus
                type="text"
                value={placeQuery}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Search boba spots..."
                className="w-full px-4 py-3 rounded-2xl border-2 text-sm font-medium outline-none transition-colors"
                style={{ borderColor: "#DDD6FE", color: "#12082A" }}
                onFocus={(e) => (e.target.style.borderColor = "#7C3AED")}
                onBlur={(e) => (e.target.style.borderColor = "#DDD6FE")}
              />
              {isSearching && (
                <div className="absolute right-3 top-3.5">
                  <div className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "#7C3AED", borderTopColor: "transparent" }} />
                </div>
              )}
            </div>

            {placeResults.length > 0 && (
              <div className="flex flex-col gap-2">
                {placeResults.map((p, i) => (
                  <button
                    key={i}
                    onClick={() => { setSelectedPlace(p); setStep("score") }}
                    className="w-full text-left bg-white rounded-2xl p-4 shadow-sm border border-purple-50 active:scale-98 transition-transform"
                  >
                    <p className="font-bold text-sm" style={{ color: "#12082A" }}>{p.name}</p>
                    <p className="text-xs mt-0.5 truncate" style={{ color: "#6B5B8A" }}>{p.address}</p>
                  </button>
                ))}
              </div>
            )}

            {/* Add manually */}
            {placeQuery.length > 1 && placeResults.length === 0 && !isSearching && (
              <button
                onClick={() => {
                  setSelectedPlace({
                    name: placeQuery,
                    address: "",
                    google_place_id: `manual_${Date.now()}`,
                    latitude: 0,
                    longitude: 0,
                  })
                  setStep("score")
                }}
                className="w-full text-left bg-white rounded-2xl p-4 shadow-sm border-2 border-dashed border-purple-200"
              >
                <p className="font-bold text-sm" style={{ color: "#7C3AED" }}>+ Add "{placeQuery}" manually</p>
                <p className="text-xs mt-0.5" style={{ color: "#6B5B8A" }}>We'll add it to the database</p>
              </button>
            )}
          </div>
        )}

        {/* Step 2: Score */}
        {step === "score" && selectedPlace && (
          <div className="flex flex-col gap-8">
            <div>
              <h2 className="text-xl font-black mb-1" style={{ color: "#12082A" }}>How was it?</h2>
              <p className="text-sm font-medium" style={{ color: "#7C3AED" }}>{selectedPlace.name}</p>
            </div>
            <ScoreSelector value={score} onChange={setScore} />
            <button
              onClick={() => setStep("details")}
              className="w-full py-4 rounded-2xl text-white font-bold text-base"
              style={{ background: "linear-gradient(135deg, #7C3AED, #9F67FF)" }}
            >
              Next →
            </button>
          </div>
        )}

        {/* Step 3: Details */}
        {step === "details" && (
          <div className="flex flex-col gap-6">
            <div>
              <h2 className="text-xl font-black mb-1" style={{ color: "#12082A" }}>Tell us more</h2>
              <p className="text-sm" style={{ color: "#6B5B8A" }}>Optional but appreciated 🧋</p>
            </div>

            {/* Review summary */}
            <div className="flex items-center gap-3 bg-white rounded-2xl p-3 shadow-sm">
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-black" style={{ background: score >= 8 ? "#059669" : score >= 6 ? "#D97706" : "#DC2626" }}>
                {score}
              </div>
              <div>
                <p className="font-bold text-sm" style={{ color: "#12082A" }}>{selectedPlace?.name}</p>
              </div>
            </div>

            {/* Body */}
            <div>
              <label className="text-sm font-bold mb-2 block" style={{ color: "#12082A" }}>Your thoughts</label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="What did you get? How were the pearls? Would you go back?"
                rows={4}
                maxLength={500}
                className="w-full px-4 py-3 rounded-2xl border-2 text-sm outline-none resize-none transition-colors"
                style={{ borderColor: "#DDD6FE", color: "#12082A" }}
                onFocus={(e) => (e.target.style.borderColor = "#7C3AED")}
                onBlur={(e) => (e.target.style.borderColor = "#DDD6FE")}
              />
              <p className="text-xs text-right mt-1" style={{ color: "#B0A0CC" }}>{body.length}/500</p>
            </div>

            {/* Tags */}
            <div>
              <label className="text-sm font-bold mb-2 block" style={{ color: "#12082A" }}>Tags</label>
              <div className="flex flex-wrap gap-2">
                {BOBA_TAGS.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    className="text-xs px-3 py-1.5 rounded-full font-medium transition-all"
                    style={selectedTags.includes(tag)
                      ? { background: "#7C3AED", color: "white" }
                      : { background: "#F3EEFF", color: "#7C3AED" }
                    }
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => submitReview()}
              disabled={isPending}
              className="w-full py-4 rounded-2xl text-white font-bold text-base disabled:opacity-60 transition-opacity"
              style={{ background: "linear-gradient(135deg, #7C3AED, #9F67FF)" }}
            >
              {isPending ? "Saving..." : "Log it 🧋"}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
