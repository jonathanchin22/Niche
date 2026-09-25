"use client"

import { track } from "@niche/analytics"
import { useRef, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { createClient } from "@niche/auth/client"
import { createReview, getRankLadder, upsertPlace } from "@niche/database"
import type { Review } from "@niche/shared-types"
import type { BobaIceLevel, BobaSugarLevel, BobaTasteAttributes } from "@niche/shared-types"
import { BobaCup } from "@/components/ui/Doodles"
import PlacePicker, { type PickedPlace } from "./PlacePicker"
import RankStep, { type NewCup } from "./RankStep"
import { APP_ID, HOME_PLACE_ID, ICE_LEVELS, SUGAR_LEVELS, TOPPINGS, formatScore, iceLabel, inferDrinkType } from "@/lib/boba"

const TASTING_NOTES = ["creamy", "chewy", "fruity", "floral", "rich", "light", "not too sweet", "refreshing"] as const

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
  const [shopQuery, setShopQuery] = useState(initialPlace?.name ?? "")
  const [place, setPlace] = useState<PickedPlace | null>(initialPlace ?? null)
  const [atHome, setAtHome] = useState(false)
  const [score, setScore] = useState(7.5)
  const [sugar, setSugar] = useState<BobaSugarLevel | null>(null)
  const [ice, setIce] = useState<BobaIceLevel | null>(null)
  const [toppings, setToppings] = useState<string[]>([])
  const [tags, setTags] = useState<string[]>([])
  const [note, setNote] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [saving, startSaving] = useTransition()
  const openedAt = useRef(Date.now())
  const [ranking, setRanking] = useState<{ cup: NewCup; ladder: Review[] } | null>(null)

  const pickPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (photoPreview) URL.revokeObjectURL(photoPreview)
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  const pickPlace = (p: PickedPlace) => { setAtHome(false); setPlace(p); setShopQuery(p.name) }
  const toggle = (list: string[], set: (v: string[]) => void, v: string) => {
    if (v === "no topping") { set(list.includes(v) ? [] : [v]); return }
    const without = list.filter(x => x !== "no topping")
    set(without.includes(v) ? without.filter(x => x !== v) : [...without, v])
  }

  const submit = () => {
    if (!drink.trim()) { setError("What did you order?"); return }
    const typedName = shopQuery.trim()
    if (!atHome && !place && !typedName) { setError("Where was it — search a shop or pick “made at home”."); return }
    setError(null)

    startSaving(async () => {
      try {
        const supabase = createClient()

        let imageUrls: string[] = []
        if (photoFile) {
          const path = `boba/${userId}/${Date.now()}.jpg`
          const blob = await compressImage(photoFile)
          const { error: uploadError } = await supabase.storage.from("review-images").upload(path, blob, { contentType: "image/jpeg" })
          if (uploadError) throw new Error("Your photo didn't upload — try again, or log it without one.")
          imageUrls = [supabase.storage.from("review-images").getPublicUrl(path).data.publicUrl]
        }

        // A typed name that wasn't picked from search is saved as-is (deduped by name).
        const chosen: PickedPlace = atHome
          ? { name: "Made at home", address: "", city: "home", state: "home", lat: 0, lng: 0, google_place_id: HOME_PLACE_ID }
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

        const drinkType = inferDrinkType(drink)
        const review = await createReview(supabase, {
          app_id: APP_ID,
          user_id: userId,
          place_id: saved.id,
          score: Math.round(score * 10) / 10,
          category: drinkType,
          item_name: drink.trim(),
          note: note.trim() || null,
          tags,
          image_urls: imageUrls,
          toppings,
          // Only what was actually picked — no invented defaults.
          taste_attributes: sugar != null || ice || drinkType
            ? ({
                ...(drinkType ? { drink_type: drinkType } : {}),
                ...(sugar != null ? { sugar_level: sugar } : {}),
                ...(ice ? { ice_level: ice } : {}),
              } as BobaTasteAttributes)
            : null,
        })

        track("cup_logged", {
          has_photo: imageUrls.length > 0,
          at_home: atHome,
          picked_place: !!chosen.google_place_id && !atHome,
          seconds_to_log: Math.round((Date.now() - openedAt.current) / 1000),
        })

        // Slot it into their own ranking with a few "which was better?" questions.
        const ladder = await getRankLadder(supabase, { user_id: userId, app_id: APP_ID, exclude_review_id: review.id }).catch(() => [])
        if (ladder.length > 0) {
          setRanking({
            ladder,
            cup: {
              id: review.id, name: drink.trim(), place: atHome ? "made at home" : chosen.name,
              score: Math.round(score * 10) / 10, photo: imageUrls[0] ?? photoPreview,
            },
          })
          return
        }
        router.replace(`/review/${review.id}`)
        router.refresh()
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong — try again.")
      }
    })
  }

  if (ranking) {
    return (
      <RankStep userId={userId} cup={ranking.cup} ladder={ranking.ladder} onDone={() => {
        router.replace(`/review/${ranking.cup.id}`)
        router.refresh()
      }} />
    )
  }

  return (
    <form onSubmit={e => { e.preventDefault(); submit() }} style={{ paddingBottom: 120 }}>
      <header style={{ display: "grid", gridTemplateColumns: "44px 1fr 44px", alignItems: "center", padding: "44px 12px 8px" }}>
        <Link href="/" aria-label="Cancel" style={{ width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="M2 2 L12 12M12 2 L2 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
        </Link>
        <span className="t-label" style={{ textAlign: "center" }}>a new sip</span>
      </header>

      <input ref={fileRef} type="file" accept="image/*" onChange={pickPhoto} className="sr-only" id="photo" />
      <div style={{ position: "relative", margin: "8px 12px 0" }}>
        {photoPreview ? (
          <>
            <img src={photoPreview} alt="Your photo" className="photo" style={{ height: 340, borderRadius: 24 }} />
            <button type="button" onClick={() => fileRef.current?.click()} style={{
              position: "absolute", right: 12, bottom: 12, height: 44, padding: "0 16px", borderRadius: 22,
              border: "none", background: "var(--c-paper)", fontSize: 13, fontWeight: 600, cursor: "pointer",
            }}>change photo</button>
          </>
        ) : (
          <label htmlFor="photo" style={{
            height: 260, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10,
            background: "var(--c-paper)", border: "1.5px dashed var(--c-rule)", borderRadius: 24, cursor: "pointer",
          }}>
            <BobaCup size={96} />
            <span style={{ fontSize: 14, fontWeight: 600 }}>add a photo</span>
            <span className="t-meta" style={{ fontSize: 12 }}>optional, but it makes the page</span>
          </label>
        )}
      </div>

      <section style={{ display: "flex", flexDirection: "column", gap: 28, padding: "26px 24px 0" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label htmlFor="drink" className="t-label">what</label>
          <input id="drink" value={drink} onChange={e => setDrink(e.target.value)} placeholder="brown sugar milk tea" autoComplete="off"
            className="line-input" style={{ height: 56, fontFamily: "var(--font-display)", fontSize: 32 }} />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10, position: "relative" }}>
          <label htmlFor="shop" className="t-label">where</label>
          {atHome ? (
            <p style={{ height: 44, display: "flex", alignItems: "center", borderBottom: "1px solid var(--c-rule)", fontSize: 17 }}>made at home</p>
          ) : (
            <PlacePicker id="shop" query={shopQuery} place={place}
              onQueryChange={q => { setShopQuery(q); if (place && q !== place.name) setPlace(null) }}
              onPick={pickPlace} />
          )}
          <div style={{ display: "flex", gap: 8, overflowX: "auto" }}>
            <button type="button" className="pill" aria-pressed={atHome} onClick={() => setAtHome(h => !h)}>made at home</button>
            {recentPlaces.map(p => (
              <button key={p.id} type="button" className="pill" aria-pressed={!atHome && place?.name === p.name} onClick={() => pickPlace(p)}>{p.name}</button>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
            <label htmlFor="score" className="t-label">score</label>
            <span className="t-score" style={{ fontSize: 62, lineHeight: 0.8 }} aria-hidden="true">{formatScore(score)}</span>
          </div>
          <input id="score" type="range" min={0} max={10} step={0.1} value={score}
            onChange={e => setScore(parseFloat(e.target.value))}
            className="score-range" style={{ ["--fill" as string]: `${score * 10}%` }}
            aria-valuetext={`${formatScore(score)} out of 10`} />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--c-mid)" }}>
            <span>0 · never again</span><span>10 · worth the line</span>
          </div>
        </div>

        <fieldset style={{ border: "none", display: "flex", flexDirection: "column", gap: 10 }}>
          <legend className="t-label" style={{ marginBottom: 10 }}>sugar</legend>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 6 }}>
            {SUGAR_LEVELS.map(s => (
              <button key={s} type="button" className="pill" aria-pressed={sugar === s} onClick={() => setSugar(sugar === s ? null : s)}
                style={{ justifyContent: "center", padding: 0 }}>{s}%</button>
            ))}
          </div>
        </fieldset>

        <fieldset style={{ border: "none", display: "flex", flexDirection: "column", gap: 10 }}>
          <legend className="t-label" style={{ marginBottom: 10 }}>ice</legend>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {ICE_LEVELS.map(i => (
              <button key={i} type="button" className="pill" aria-pressed={ice === i} onClick={() => setIce(ice === i ? null : i)}>{iceLabel(i)}</button>
            ))}
          </div>
        </fieldset>

        <fieldset style={{ border: "none", display: "flex", flexDirection: "column", gap: 10 }}>
          <legend className="t-label" style={{ marginBottom: 10 }}>toppings</legend>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {TOPPINGS.map(t => (
              <button key={t} type="button" className="pill" aria-pressed={toppings.includes(t)} onClick={() => toggle(toppings, setToppings, t)}>{t}</button>
            ))}
          </div>
        </fieldset>

        <fieldset style={{ border: "none", display: "flex", flexDirection: "column", gap: 10 }}>
          <legend className="t-label" style={{ marginBottom: 10 }}>tasted</legend>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {TASTING_NOTES.map(t => (
              <button key={t} type="button" className="pill" aria-pressed={tags.includes(t)} onClick={() => toggle(tags, setTags, t)}>{t}</button>
            ))}
          </div>
        </fieldset>

        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label htmlFor="note" className="t-label">a note to future you</label>
          <textarea id="note" rows={2} value={note} maxLength={500} onChange={e => setNote(e.target.value)} placeholder="would you order it again?"
            className="line-input" style={{ padding: "8px 0", fontFamily: "var(--font-hand)", fontSize: 24, lineHeight: 1.2, resize: "none" }} />
        </div>

        {error && <p role="alert" style={{ fontSize: 14, fontWeight: 600 }}>{error}</p>}
      </section>

      <div style={{
        position: "fixed", left: "50%", bottom: 0, transform: "translateX(-50%)", width: "100%", maxWidth: 430,
        padding: "14px 24px max(30px, env(safe-area-inset-bottom))", background: "var(--c-bg)", borderTop: "1px solid var(--c-rule)",
      }}>
        <button type="submit" disabled={saving} className="btn btn-primary" style={{ width: "100%" }}>
          {saving ? "logging…" : "log this boba"}
        </button>
      </div>
    </form>
  )
}
