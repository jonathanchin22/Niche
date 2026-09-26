"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { track } from "@niche/analytics"
import { createClient } from "@niche/auth/client"
import { getCurrentPosition, upsertPlace } from "@niche/database"
import { APP_ID } from "@/lib/boba"

/** Best-effort street address for a point (OpenStreetMap Nominatim). */
async function addressAt(lat: number, lng: number) {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`, { signal: AbortSignal.timeout(5000) })
    if (!res.ok) return null
    const a = (await res.json()).address ?? {}
    return {
      address: [a.house_number, a.road].filter(Boolean).join(" "),
      city: a.city ?? a.town ?? a.village ?? a.suburb ?? "",
      state: a.state ?? "",
    }
  } catch {
    return null
  }
}

/**
 * A shop that was added by name only has no spot on the map. Someone standing
 * in it can pin it: it then shows on the map, in "near you" and in "be the first".
 */
export default function PinPlaceButton({ name }: { name: string }) {
  const router = useRouter()
  const [state, setState] = useState<"idle" | "busy" | "no-location" | "error">("idle")

  const pin = async () => {
    setState("busy")
    const pos = await getCurrentPosition()
    if (!pos) { setState("no-location"); return }
    try {
      const where = await addressAt(pos.lat, pos.lng)
      // Same name, no OSM id: find_or_create_place updates this row's location.
      await upsertPlace(createClient(), {
        app_id: APP_ID, name, address: where?.address ?? "", city: where?.city ?? "", state: where?.state ?? "",
        country: "US", lat: pos.lat, lng: pos.lng, google_place_id: null, foursquare_id: null, cover_image_url: null,
      })
      track("cafe_pinned")
      router.refresh()
    } catch {
      setState("error")
    }
  }

  return (
    <section style={{ margin: "26px 24px 0", padding: "18px 20px", border: "1px dashed var(--c-rule)", borderRadius: 18, display: "flex", flexDirection: "column", gap: 10 }}>
      <span className="t-title" style={{ fontSize: 20 }}>not on the map yet</span>
      <span className="t-meta" style={{ fontSize: 13, lineHeight: 1.5 }}>
        Are you at {name} right now? Pin it where you’re standing so others can find it nearby.
      </span>
      <button type="button" onClick={pin} disabled={state === "busy"} className="btn btn-secondary" style={{ alignSelf: "flex-start", padding: "0 16px" }}>
        {state === "busy" ? "pinning…" : "📍 I’m here — pin it"}
      </button>
      {state === "no-location" && <span className="t-meta" style={{ fontSize: 12 }}>Turn on location to pin it.</span>}
      {state === "error" && <span className="t-meta" style={{ fontSize: 12 }}>Couldn’t save that — try again.</span>}
    </section>
  )
}
