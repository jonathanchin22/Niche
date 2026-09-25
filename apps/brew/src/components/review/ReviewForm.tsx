"use client"

import { useRef, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { createClient } from "@niche/auth/client"
import { createReview, upsertPlace } from "@niche/database"
import { SteamingCup } from "@/components/ui/Doodles"
import PlacePicker, { type PickedPlace } from "./PlacePicker"
import { APP_ID, HOME_PLACE_ID, formatScore } from "@/lib/brew"

const TASTING_NOTES = ["silky", "nutty", "bright", "chocolatey", "fruity", "floral", "bold", "smooth", "syrupy", "clean"] as const

// Drink types we recognise in the name, used for category (and the no-photo doodle).
const CATEGORIES = [
  "flat white", "pour over", "cold brew", "cortado", "cappuccino", "latte", "espresso",
  "americano", "macchiato", "mocha", "aeropress", "filter", "matcha", "gibraltar",
] as const

function inferCategory(drink: string) {
  const text = drink.toLowerCase()
  return CATEGORIES.find(c => text.includes(c)) ?? null
}

async function compressImage(file: File, maxWidth = 1400): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const objectUrl = URL.createObjectURL(file)
    img.onload = () => {
      const scale = Math.min(1, maxWidth / img.width)
      const canvas = document.createElement("canvas")
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      const ctx = canvas.getContext("2d")
      URL.revokeObjectURL(objectUrl)
      if (!ctx) return reject(new Error("Could not process the photo"))
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      canvas.toBlob(b => (b ? resolve(b) : reject(new Error("Could not process the photo"))), "image/jpeg", 0.82)
    }
    img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error("Could not read that photo")) }
    img.src = objectUrl
  })
}

export interface RecentPlace extends PickedPlace { id: string }

export default function ReviewForm({ userId, recentPlaces, initialPlace }: {
  userId: string
  recentPlaces: RecentPlace[]
  initialPlace?: RecentPlace | null
}) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [drink, setDrink] = useState("")
  const [cafe, setCafe] = useState(initialPlace?.name ?? "")
  const [place, setPlace] = useState<PickedPlace | null>(initialPlace ?? null)
  const [atHome, setAtHome] = useState(false)
  const [score, setScore] = useState(7.5)
  const [tags, setTags] = useState<string[]>([])
  const [note, setNote] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [saving, startSaving] = useTransition()

  const pickPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (photoPreview) URL.revokeObjectURL(photoPreview)
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  const toggleTag = (t: string) => setTags(prev => (prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]))

  const submit = () => {
    if (!drink.trim()) { setError("What did you drink?"); return }
    if (!atHome && !cafe.trim()) { setError("Where was it — pick a café or “at home”."); return }
    setError(null)

    startSaving(async () => {
      try {
        const supabase = createClient()

        let imageUrls: string[] = []
        if (photoFile) {
          const path = `brew/${userId}/${Date.now()}.jpg`
          const blob = await compressImage(photoFile)
          const { error: uploadError } = await supabase.storage.from("review-images").upload(path, blob, { contentType: "image/jpeg" })
          if (uploadError) throw new Error("Your photo didn't upload — try again, or log it without one.")
          imageUrls = [supabase.storage.from("review-images").getPublicUrl(path).data.publicUrl]
        }

        // A picked café keeps its address and map position; a typed name is
        // saved as-is (and matched by name next time).
        const typedName = cafe.trim()
        const chosen: PickedPlace = atHome
          ? { name: "Brewed at home", address: "", city: "home", state: "home", lat: 0, lng: 0, google_place_id: HOME_PLACE_ID }
          : place && place.name === typedName
            ? place
            : { name: typedName, address: "", city: "", state: "", lat: 0, lng: 0, google_place_id: null }

        const saved = await upsertPlace(supabase, {
          app_id: APP_ID,
          ...chosen,
          country: "US",
          foursquare_id: null,
          cover_image_url: null,
        })

        const review = await createReview(supabase, {
          app_id: APP_ID,
          user_id: userId,
          place_id: saved.id,
          score: Math.round(score * 10) / 10,
          category: inferCategory(drink),
          item_name: drink.trim(),
          note: note.trim() || null,
          tags,
          image_urls: imageUrls,
        })

        router.replace(`/review/${review.id}`)
        router.refresh()
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong — try again.")
      }
    })
  }

  return (
    <form onSubmit={e => { e.preventDefault(); submit() }} style={{ paddingBottom: 120 }}>
      <header style={{ display: "grid", gridTemplateColumns: "44px 1fr 44px", alignItems: "center", padding: "44px 12px 8px" }}>
        <Link href="/" aria-label="Cancel" style={{ width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="M2 2 L12 12M12 2 L2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
        </Link>
        <span className="t-label" style={{ textAlign: "center", letterSpacing: "0.16em" }}>a new cup</span>
      </header>

      <input ref={fileRef} type="file" accept="image/*" onChange={pickPhoto} className="sr-only" id="photo" />
      <div style={{ position: "relative", margin: "8px 12px 0" }}>
        {photoPreview ? (
          <>
            <img src={photoPreview} alt="Your photo" className="photo" style={{ height: 330 }} />
            <button type="button" onClick={() => fileRef.current?.click()} className="btn-sm" style={{
              position: "absolute", right: 10, bottom: 10, height: 44, padding: "0 16px", borderRadius: 22,
              border: "none", background: "var(--c-paper)", fontSize: 13, cursor: "pointer",
            }}>change photo</button>
          </>
        ) : (
          <label htmlFor="photo" style={{
            height: 260, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10,
            background: "var(--c-paper)", border: "1px dashed var(--c-rule)", borderRadius: 2, cursor: "pointer",
          }}>
            <SteamingCup size={96} />
            <span style={{ fontSize: 14, fontWeight: 500 }}>add a photo</span>
            <span className="t-meta" style={{ fontSize: 12 }}>optional, but it makes the page</span>
          </label>
        )}
      </div>

      <section style={{ display: "flex", flexDirection: "column", gap: 28, padding: "26px 24px 0" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label htmlFor="drink" className="t-label">what</label>
          <input id="drink" value={drink} onChange={e => setDrink(e.target.value)} placeholder="flat white" autoComplete="off"
            className="line-input" style={{ height: 56, fontFamily: "var(--font-display)", fontWeight: 300, fontSize: 38 }} />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <label htmlFor="cafe" className="t-label">where</label>
          {atHome ? (
            <p style={{ height: 44, display: "flex", alignItems: "center", borderBottom: "1px solid var(--c-rule)", fontSize: 17 }}>at home</p>
          ) : (
            <PlacePicker id="cafe" query={cafe} place={place}
              onQueryChange={q => { setCafe(q); if (place && q !== place.name) setPlace(null) }}
              onPick={p => { setAtHome(false); setPlace(p); setCafe(p.name) }} />
          )}
          <div style={{ display: "flex", gap: 8, overflowX: "auto" }}>
            <button type="button" className="pill" aria-pressed={atHome} onClick={() => setAtHome(h => !h)}>at home</button>
            {recentPlaces.map(p => (
              <button key={p.id} type="button" className="pill" aria-pressed={!atHome && cafe === p.name}
                onClick={() => { setAtHome(false); setPlace(p); setCafe(p.name) }}>{p.name}</button>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
            <label htmlFor="score" className="t-label">score</label>
            <span className="t-score" style={{ fontSize: 64, lineHeight: 0.8 }} aria-hidden="true">{formatScore(score)}</span>
          </div>
          <input id="score" type="range" min={0} max={10} step={0.1} value={score}
            onChange={e => setScore(parseFloat(e.target.value))}
            className="score-range" style={{ ["--fill" as string]: `${score * 10}%` }}
            aria-valuetext={`${formatScore(score)} out of 10`} />
          <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--c-mid)" }}>
            <span>0 · not again</span><span>10 · life-changing</span>
          </div>
        </div>

        <fieldset style={{ border: "none", display: "flex", flexDirection: "column", gap: 10 }}>
          <legend className="t-label" style={{ marginBottom: 10 }}>tasted like</legend>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {TASTING_NOTES.map(t => (
              <button key={t} type="button" className="pill" aria-pressed={tags.includes(t)} onClick={() => toggleTag(t)}>{t}</button>
            ))}
          </div>
        </fieldset>

        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label htmlFor="note" className="t-label">a note to future you</label>
          <textarea id="note" rows={2} value={note} maxLength={500} onChange={e => setNote(e.target.value)} placeholder="what made it good?"
            className="line-input" style={{ padding: "8px 0", fontFamily: "var(--font-hand)", fontSize: 24, lineHeight: 1.2, resize: "none" }} />
        </div>

        {error && <p role="alert" style={{ fontSize: 14, color: "var(--c-ink)" }}>{error}</p>}
      </section>

      <div style={{
        position: "fixed", left: "50%", bottom: 0, transform: "translateX(-50%)", width: "100%", maxWidth: 430,
        padding: "14px 24px max(30px, env(safe-area-inset-bottom))", background: "var(--c-bg)", borderTop: "1px solid var(--c-rule)",
      }}>
        <button type="submit" disabled={saving} className="btn btn-primary" style={{ width: "100%" }}>
          {saving ? "logging…" : "log this cup"}
        </button>
      </div>
    </form>
  )
}
