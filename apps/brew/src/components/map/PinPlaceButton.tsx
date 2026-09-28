"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { track } from "@niche/analytics"
import { createClient } from "@niche/auth/client"
import { addressAt, getCurrentPosition, upsertPlace } from "@niche/database"
import { APP_ID } from "@/lib/brew"
import MapChooser from "./MapChooser"

/**
 * A café that was added by name only has no spot on the map. Someone standing
 * in it can pin it, or anyone can find it on the map: it then shows on the
 * map, in "near you" and in "be the first".
 */
export default function PinPlaceButton({ name }: { name: string }) {
  const router = useRouter()
  const [state, setState] = useState<"idle" | "busy" | "no-location" | "error">("idle")
  const [choosing, setChoosing] = useState(false)

  const save = async (spot: { lat: number; lng: number; address: string; city: string; state: string }, how: "here" | "map") => {
    try {
      // Same name, no OSM id: find_or_create_place updates this row's location.
      await upsertPlace(createClient(), {
        app_id: APP_ID, name, address: spot.address, city: spot.city, state: spot.state,
        country: "US", lat: spot.lat, lng: spot.lng, google_place_id: null, foursquare_id: null, cover_image_url: null,
      })
      track("cafe_pinned", { how })
      setChoosing(false)
      router.refresh()
    } catch {
      setChoosing(false)
      setState("error")
    }
  }

  const pinHere = async () => {
    setState("busy")
    const pos = await getCurrentPosition()
    if (!pos) { setState("no-location"); return }
    const where = await addressAt(pos.lat, pos.lng)
    await save({ lat: pos.lat, lng: pos.lng, address: where?.address ?? "", city: where?.city ?? "", state: where?.state ?? "" }, "here")
  }

  return (
    <section style={{ margin: "26px 24px 0", padding: "18px 20px", border: "1px dashed var(--c-rule)", borderRadius: 2, display: "flex", flexDirection: "column", gap: 10 }}>
      <span className="t-title" style={{ fontSize: 20 }}>not on the map yet</span>
      <span className="t-meta" style={{ fontSize: 13, lineHeight: 1.5 }}>
        Pin {name} so others can find it nearby — where you’re standing if you’re there now, or find it on the map.
      </span>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <button type="button" onClick={pinHere} disabled={state === "busy"} className="btn btn-secondary" style={{ padding: "0 16px" }}>
          {state === "busy" ? "pinning…" : "📍 I’m here — pin it"}
        </button>
        <button type="button" onClick={() => setChoosing(true)} className="btn btn-secondary" style={{ padding: "0 16px" }}>
          🗺 choose on map
        </button>
      </div>
      {state === "no-location" && <span className="t-meta" style={{ fontSize: 12 }}>Turn on location to pin it here — or choose it on the map.</span>}
      {state === "error" && <span className="t-meta" style={{ fontSize: 12 }}>Couldn’t save that — try again.</span>}
      {choosing && (
        <MapChooser name={name} start={null} pinOnly onClose={() => setChoosing(false)}
          onChoose={c => c.kind === "spot" ? save(c, "map") : undefined} />
      )}
    </section>
  )
}
