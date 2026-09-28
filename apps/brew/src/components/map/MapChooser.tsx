"use client"

import { useEffect, useRef, useState, type FormEvent } from "react"
import { createPortal } from "react-dom"
import { addressAt, distanceMetres, geocodeArea, getCurrentPosition, type CatalogPlace, type LatLng } from "@niche/database"
import CafeMap, { type MapCamera, type MapPin } from "./CafeMap"

/** What was chosen: a café already on the map, or a spot for a new one. */
export type MapChoice =
  | { kind: "place"; place: CatalogPlace }
  | { kind: "spot"; name: string; lat: number; lng: number; address: string; city: string; state: string }

// Nowhere to start from (no location, nothing passed in): the whole country.
const FALLBACK: MapCamera = { lat: 39.5, lng: -98.35, zoom: 3 }

/**
 * "Choose on map", for logging after the fact: tap a café that's already on
 * the map, or move the map until the centre pin sits on the spot and add it
 * there. With `pinOnly`, it only places `name` (a café page with no location).
 */
export default function MapChooser({ name, start, pinOnly = false, onChoose, onClose }: {
  name: string
  start: LatLng | null
  pinOnly?: boolean
  onChoose: (choice: MapChoice) => void | Promise<void>
  onClose: () => void
}) {
  const [me, setMe] = useState<LatLng | null>(start)
  const [origin, setOrigin] = useState<MapCamera | null>(start ? { ...start, zoom: 15 } : null)
  const [mapKey, setMapKey] = useState(0)
  const [camera, setCamera] = useState<MapCamera | null>(null)
  const [places, setPlaces] = useState<CatalogPlace[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [draft, setDraft] = useState(name)
  const [jump, setJump] = useState("")
  const [status, setStatus] = useState<"idle" | "busy" | "not-found">("idle")
  const loadedAt = useRef<{ at: LatLng; radius: number } | null>(null)

  // Start where you are, if we don't know yet.
  useEffect(() => {
    if (start) return
    let live = true
    getCurrentPosition().then(pos => {
      if (!live) return
      setMe(pos)
      setOrigin(pos ? { ...pos, zoom: 15 } : FALLBACK)
    })
    return () => { live = false }
  }, [start])

  // The page underneath stays put; Escape closes.
  const close = useRef(onClose)
  close.current = onClose
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close.current() }
    window.addEventListener("keydown", onKey)
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", onKey) }
  }, [])

  // Cafés for wherever the map is, once it's zoomed in enough to be useful.
  useEffect(() => {
    if (pinOnly) return
    const view = camera ?? (origin && origin.zoom >= 12 ? { ...origin, radius: 2500 } : null)
    if (!view || (view.radius ?? 0) > 8000) return
    const last = loadedAt.current
    // Already loaded around here (and not zoomed out much since).
    if (last && distanceMetres(last.at, view) < last.radius * 0.4 && (view.radius ?? 0) < last.radius * 1.5) return
    const ctrl = new AbortController()
    const t = setTimeout(async () => {
      const radius = Math.round(Math.min(Math.max(view.radius ?? 2500, 500), 8000))
      try {
        const res = await fetch(`/api/places/near?lat=${view.lat}&lng=${view.lng}&radius=${radius}`, { signal: ctrl.signal })
        if (!res.ok) return
        const data: { places: CatalogPlace[] } = await res.json()
        loadedAt.current = { at: { lat: view.lat, lng: view.lng }, radius }
        setPlaces(data.places.filter(p => Number(p.lat) !== 0 || Number(p.lng) !== 0))
      } catch {
        // Moved again, or offline: the map still works for dropping a pin.
      }
    }, 400)
    return () => { clearTimeout(t); ctrl.abort() }
  }, [camera, origin, pinOnly])

  const pins: MapPin[] = places.map(p => ({
    id: p.id, name: p.name, lat: Number(p.lat), lng: Number(p.lng),
    score: p.review_count > 0 && p.avg_score != null ? Number(p.avg_score) : null, href: `/place/${p.id}`,
  }))
  const selected = places.find(p => p.id === selectedId) ?? null
  const centre = camera ?? origin

  const goTo = async (e: FormEvent) => {
    e.preventDefault()
    const q = jump.trim()
    if (!q) return
    setStatus("busy")
    const hit = await geocodeArea(q)
    if (!hit) { setStatus("not-found"); return }
    setStatus("idle")
    setSelectedId(null)
    setCamera(null)
    setOrigin({ ...hit, zoom: 15 })
    setMapKey(k => k + 1)
  }

  const addHere = async () => {
    const newName = draft.trim()
    if (!centre || !newName) return
    setStatus("busy")
    try {
      const where = await addressAt(centre.lat, centre.lng)
      await onChoose({ kind: "spot", name: newName, lat: centre.lat, lng: centre.lng, address: where?.address ?? "", city: where?.city ?? "", state: where?.state ?? "" })
    } finally {
      setStatus("idle")
    }
  }

  // On document.body, above the tab bar (z-index 100) and any page stacking.
  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="Choose on map" style={{ position: "fixed", inset: 0, zIndex: 200, background: "var(--c-bg)", display: "flex", justifyContent: "center" }}>
      <div style={{ width: "100%", maxWidth: 430, display: "flex", flexDirection: "column" }}>
        <header style={{ display: "grid", gridTemplateColumns: "44px 1fr 44px", alignItems: "center", padding: "max(12px, env(safe-area-inset-top)) 8px 4px" }}>
          <button type="button" onClick={onClose} aria-label="Close map" style={{ width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center", background: "none", border: "none", cursor: "pointer", color: "inherit" }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="M2 2 L12 12M12 2 L2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
          </button>
          <span className="t-label" style={{ textAlign: "center", letterSpacing: "0.16em" }}>{pinOnly ? `where is ${name}?` : "choose on map"}</span>
        </header>

        <form onSubmit={goTo} style={{ display: "flex", gap: 8, padding: "0 16px 10px" }}>
          <input value={jump} onChange={e => { setJump(e.target.value); setStatus("idle") }} placeholder="jump to a city or address" aria-label="Jump to a city or address"
            className="line-input" style={{ flex: 1, height: 40, fontSize: 15 }} />
          <button type="submit" className="btn-sm" disabled={status === "busy" || !jump.trim()} style={{ height: 40, padding: "0 14px", borderRadius: 20, border: "1px solid var(--c-rule)", background: "var(--c-paper)", cursor: "pointer", fontSize: 13 }}>go</button>
        </form>
        {status === "not-found" && <p className="t-meta" style={{ fontSize: 12, padding: "0 16px 8px" }}>Couldn’t find “{jump.trim()}”.</p>}

        <div style={{ position: "relative", flex: 1, minHeight: 0 }}>
          {origin ? (
            // Opening on your location: frame you and the nearest cafés (as Explore
            // does). After a jump, open right where that is.
            <CafeMap key={mapKey} center={me ?? origin} camera={mapKey === 0 && me ? null : origin} showMe={!!me} pins={pins} height="100%"
              onCameraChange={setCamera} selectedId={selectedId} onSelect={pinOnly ? undefined : setSelectedId} />
          ) : (
            <p className="t-meta" style={{ padding: 24, fontSize: 13 }}>finding where you are…</p>
          )}
          {origin && !selected && (
            // The centre pin: where a new café goes.
            <svg aria-hidden="true" width="26" height="34" viewBox="0 0 26 34" style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -100%)", pointerEvents: "none", filter: "drop-shadow(0 1px 2px rgba(28,20,16,.3))" }}>
              <path d="M13 33 C13 33 1.5 20.5 1.5 12.5 A11.5 11.5 0 0 1 24.5 12.5 C24.5 20.5 13 33 13 33 Z" fill="var(--c-ink)" />
              <circle cx="13" cy="12.5" r="4.2" fill="var(--c-paper)" />
            </svg>
          )}
        </div>

        <section style={{ padding: "14px 16px max(16px, env(safe-area-inset-bottom))", display: "flex", flexDirection: "column", gap: 10, borderTop: "1px solid var(--c-rule)", background: "var(--c-paper)" }}>
          {selected ? (
            <>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 16, fontWeight: 600 }}>{selected.name}</span>
                  {(selected.address || selected.city) && <span className="t-meta" style={{ display: "block", fontSize: 12 }}>{[selected.address, selected.city].filter(Boolean).join(", ")}</span>}
                </span>
                <button type="button" onClick={() => setSelectedId(null)} className="t-meta" style={{ minHeight: 32, padding: 0, background: "none", border: "none", cursor: "pointer", fontSize: 13, textDecoration: "underline", textUnderlineOffset: 3 }}>not this one</button>
              </div>
              <button type="button" onClick={() => onChoose({ kind: "place", place: selected })} className="btn btn-primary" style={{ padding: 0 }}>
                log it at {selected.name}
              </button>
            </>
          ) : (
            <>
              <p className="t-meta" style={{ fontSize: 13, lineHeight: 1.5 }}>
                {pinOnly ? "Move the map so the pin sits on it." : "Tap a café on the map — or, if it isn’t there, move the map so the pin sits on it and add it."}
              </p>
              {!pinOnly && (
                <input value={draft} onChange={e => setDraft(e.target.value)} placeholder="café name" aria-label="New café name"
                  className="line-input" style={{ height: 40, fontSize: 15 }} />
              )}
              <button type="button" onClick={addHere} disabled={!origin || !draft.trim() || status === "busy"} className="btn btn-secondary" style={{ padding: 0 }}>
                {status === "busy" ? "one sec…" : pinOnly ? `📍 pin ${name} here` : draft.trim() ? `＋ add “${draft.trim()}” here` : "＋ add a café here"}
              </button>
            </>
          )}
        </section>
      </div>
    </div>,
    document.body,
  )
}
