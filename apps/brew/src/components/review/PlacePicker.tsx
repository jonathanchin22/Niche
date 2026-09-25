"use client"

import { useEffect, useMemo, useState } from "react"
import { findNearbyPlaces, formatDistance, getCurrentPosition, searchPlacesByName, type FoundPlace, type LatLng } from "@niche/database"

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

  useEffect(() => {
    const ctrl = new AbortController()
    getCurrentPosition().then(async pos => {
      if (!pos) { setStatus("off"); return }
      setHere(pos)
      const found = await findNearbyPlaces("cafe", pos, { limit: 30, signal: ctrl.signal }).catch(() => [])
      if (!ctrl.signal.aborted) { setNearby(found); setStatus("ready") }
    })
    return () => ctrl.abort()
  }, [])

  const q = query.trim()
  const picked = !!place && place.name === q

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
