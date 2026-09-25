"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { track } from "@niche/analytics"
import { detectCurrentPlace, findNearbyPlaces, formatDistance, getCurrentPosition, searchPlacesByName, type FoundPlace, type LatLng } from "@niche/database"

export type PickedPlace = Omit<FoundPlace, "google_place_id" | "distance"> & { google_place_id: string | null }

/**
 * The "where" field: cafés near you appear as soon as the screen opens, typing
 * filters them instantly and then searches further afield.
 */
export default function PlacePicker({ id, query, place, onQueryChange, onPick }: {
  id: string
  query: string
  place: PickedPlace | null
  onQueryChange: (q: string) => void
  onPick: (p: PickedPlace) => void
}) {
  const [here, setHere] = useState<LatLng | null>(null)
  const [nearby, setNearby] = useState<FoundPlace[]>([])
  const [status, setStatus] = useState<"locating" | "ready" | "off">("locating")
  const [remote, setRemote] = useState<FoundPlace[]>([])
  // "You're at <café>": auto-picked when the person is clearly inside one.
  const [detected, setDetected] = useState<FoundPlace | null>(null)
  const untouched = useRef(true)
  untouched.current = untouched.current && !query && !place

  useEffect(() => {
    const ctrl = new AbortController()
    getCurrentPosition().then(async pos => {
      if (!pos) { setStatus("off"); return }
      setHere(pos)
      const found = await findNearbyPlaces("cafe", pos, { limit: 30, signal: ctrl.signal }).catch(() => [])
      if (ctrl.signal.aborted) return
      setNearby(found)
      setStatus("ready")
      // Only if they haven't typed or picked anything while we were looking.
      const here = detectCurrentPlace(found, pos)
      if (here && untouched.current) {
        setDetected(here)
        onPick(here)
        track("cafe_autodetected", { distance: Math.round(here.distance ?? 0) })
      }
    })
    return () => ctrl.abort()
    // Runs once per visit to the screen; onPick is read at that moment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const q = query.trim()
  const picked = !!place && place.name === q
  const showDetected = !!detected && picked && place?.google_place_id === detected.google_place_id

  const notHere = () => {
    track("cafe_autodetect_rejected")
    setDetected(null)
    onQueryChange("")
  }

  useEffect(() => {
    if (picked || q.length < 3) { setRemote([]); return }
    const ctrl = new AbortController()
    const t = setTimeout(() => {
      searchPlacesByName(q, here, { signal: ctrl.signal }).then(setRemote).catch(() => {})
    }, 350)
    return () => { clearTimeout(t); ctrl.abort() }
  }, [q, picked, here])

  const suggestions = useMemo(() => {
    if (picked) return []
    if (!q) return nearby.slice(0, 5)
    const needle = q.toLowerCase()
    const local = nearby.filter(p => p.name.toLowerCase().includes(needle)).slice(0, 4)
    const ids = new Set(local.map(p => p.google_place_id))
    return [...local, ...remote.filter(p => !ids.has(p.google_place_id))].slice(0, 6)
  }, [picked, q, nearby, remote])

  return (
    <>
      <input id={id} value={query} onChange={e => onQueryChange(e.target.value)}
        placeholder={status === "ready" && nearby.length ? "pick one below, or type a name" : "café name"}
        autoComplete="off" role="combobox" aria-expanded={suggestions.length > 0} aria-controls={`${id}-options`}
        className="line-input" style={{ height: 44, fontSize: 17 }} />

      {showDetected && (
        <p className="t-meta" style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
          <svg width="11" height="14" viewBox="0 0 11 14" fill="none" aria-hidden="true">
            <path d="M5.5 13 C5.5 13 1 8.2 1 5.2 A4.5 4.5 0 0 1 10 5.2 C10 8.2 5.5 13 5.5 13 Z" stroke="currentColor" strokeWidth="1.3" />
            <circle cx="5.5" cy="5.2" r="1.5" fill="currentColor" />
          </svg>
          looks like you’re here ·
          <button type="button" onClick={notHere} style={{ minHeight: 32, padding: 0, background: "none", border: "none", color: "inherit", textDecoration: "underline", textUnderlineOffset: 3, cursor: "pointer", fontSize: 13 }}>
            not here?
          </button>
        </p>
      )}

      {!picked && !q && status === "locating" && (
        <p className="t-meta" style={{ fontSize: 13 }}>finding cafés near you…</p>
      )}

      {suggestions.length > 0 && (
        <div>
          {!q && <p className="t-label" style={{ marginBottom: 4 }}>near you</p>}
          <ul id={`${id}-options`} role="listbox" style={{ listStyle: "none" }}>
            {suggestions.map(p => (
              <li key={p.google_place_id} role="option" aria-selected={false}>
                <button type="button" onClick={() => onPick(p)} style={{
                  width: "100%", minHeight: 52, padding: "8px 0", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
                  textAlign: "left", background: "none", border: "none", borderBottom: "1px solid var(--c-rule)", cursor: "pointer",
                }}>
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: 15, fontWeight: 500 }}>{p.name}</span>
                    {(p.address || p.city) && (
                      <span className="t-meta" style={{ display: "block", fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {[p.address, p.city].filter(Boolean).join(", ")}
                      </span>
                    )}
                  </span>
                  {p.distance != null && <span className="t-label" style={{ flexShrink: 0 }}>{formatDistance(p.distance)}</span>}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  )
}
