"use client"

import dynamic from "next/dynamic"
import Link from "next/link"
import { useEffect, useMemo, useRef, useState } from "react"
import { distanceMetres, firstProgress, formatDistance, type CatalogPlace, type LatLng } from "@niche/database"
import type { MapCamera } from "@/components/map/CafeMap"
import FirstBadgeRow from "@/components/badges/FirstBadgeRow"
import { SectionHeading } from "@/components/ui/Primitives"
import { formatScore } from "@/lib/brew"
import { readNearState, writeNearState, type SearchArea } from "./nearState"

// MapLibre is ~200 kB; only load it when someone switches to the map.
const CafeMap = dynamic(() => import("@/components/map/CafeMap"), {
  ssr: false,
  loading: () => <div style={{ height: 420, background: "var(--c-tint)", borderRadius: 2 }} />,
})

const KIND_LABEL: Record<string, string> = { specialty: "specialty", chain: "chain", casual: "café" }

export type NearStatus = "locating" | "loading" | "ready" | "no-location" | "error"

const isReviewed = (p: CatalogPlace) => p.review_count > 0 && p.avg_score != null
const metaLine = (p: CatalogPlace) => [p.kind ? KIND_LABEL[p.kind] : null, ...p.descriptors.slice(0, 2)].filter(Boolean).join(" · ")

/**
 * Every café around you — reviewed or not — as a list or a map, plus a
 * "be the first" tab of the ones nobody has logged yet.
 */
export default function NearYou({ here, status, places, firsts, area, searching, onSearchArea }: {
  here: LatLng | null
  status: NearStatus
  places: CatalogPlace[]
  firsts: number
  /** Set when the places come from "search this area" rather than around you. */
  area: SearchArea | null
  searching: boolean
  onSearchArea: (area: SearchArea | null) => void
}) {
  const [tab, setTab] = useState<"near" | "first">("near")
  const [view, setView] = useState<"list" | "map">("list")
  const [expanded, setExpanded] = useState(false)
  const [camera, setCamera] = useState<MapCamera | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [restored, setRestored] = useState(false)

  // Come back to the same tab, view, pin and map position after opening a café.
  useEffect(() => {
    const saved = readNearState()
    if (saved) {
      setTab(saved.tab)
      setView(saved.view)
      setCamera(saved.camera)
      setSelectedId(saved.selectedId)
    }
    // Links from badges (/explore?tab=first) open straight on "be the first".
    if (new URLSearchParams(window.location.search).get("tab") === "first") setTab("first")
    setRestored(true)
  }, [])
  useEffect(() => {
    if (restored) writeNearState({ tab, view, selectedId })
  }, [restored, tab, view, selectedId])

  const unreviewed = useMemo(() => places.filter(p => !isReviewed(p)), [places])
  const list = tab === "first" ? unreviewed : places
  // Independents first, chains after (each group still nearest first): a
  // dozen Starbucks shouldn't bury the one local roaster.
  const ordered = useMemo(() => [...list.filter(p => p.kind !== "chain"), ...list.filter(p => p.kind === "chain")], [list])
  const shown = expanded ? ordered : ordered.slice(0, 10)
  const pins = useMemo(() => list.map(p => ({
    id: p.id, name: p.name, lat: p.lat, lng: p.lng, score: isReviewed(p) ? p.avg_score : null, href: `/place/${p.id}`,
  })), [list])
  const selected = list.find(p => p.id === selectedId) ?? null
  const progress = firstProgress(firsts)

  // "Search this area" shows once the map has moved away from where the
  // current places were loaded (the first settled view, or the last search).
  const [baseline, setBaseline] = useState<MapCamera | null>(null)
  const baselineRef = useRef<MapCamera | null>(null)
  const [mapKey, setMapKey] = useState(0)
  const onCamera = (c: MapCamera) => {
    setCamera(c)
    writeNearState({ camera: c })
    if (!baselineRef.current) { baselineRef.current = c; setBaseline(c) }
  }
  const moved = !!camera && !!baseline && (
    distanceMetres(baseline, camera) > Math.max(200, (camera.radius ?? 1000) * 0.3) ||
    Math.abs(camera.zoom - baseline.zoom) >= 1
  )
  const searchHere = () => {
    if (!camera) return
    setSelectedId(null)
    baselineRef.current = camera
    setBaseline(camera)
    onSearchArea({ lat: camera.lat, lng: camera.lng, radius: camera.radius ?? 2500 })
  }
  const backToYou = () => {
    setSelectedId(null)
    setCamera(null)
    writeNearState({ camera: null })
    baselineRef.current = null
    setBaseline(null)
    setMapKey(k => k + 1)
    onSearchArea(null)
  }

  return (
    <section aria-labelledby="near-you">
      <SectionHeading aside={places.length > 0 ? (
        <span role="group" aria-label="View" style={{ display: "flex", gap: 6 }}>
          <button type="button" className="pill" aria-pressed={view === "list"} onClick={() => setView("list")}>list</button>
          <button type="button" className="pill" aria-pressed={view === "map"} onClick={() => setView("map")}>map</button>
        </span>
      ) : undefined}>
        <span id="near-you">near you</span>
      </SectionHeading>

      {area && (
        <p className="t-meta" style={{ padding: "0 24px 10px", fontSize: 13 }}>
          Showing cafés around the map area ·{" "}
          <button type="button" onClick={backToYou} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", font: "inherit", color: "var(--c-ink)", textDecoration: "underline", textUnderlineOffset: 3 }}>
            back to near you
          </button>
        </p>
      )}

      <div role="tablist" aria-label="Which cafés" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", margin: "0 24px 14px" }}>
        {([["near", "everything"], ["first", "be the first"]] as const).map(([key, label]) => (
          <button key={key} type="button" role="tab" aria-selected={tab === key}
            onClick={() => { setTab(key); setSelectedId(null); setExpanded(false) }}
            style={{
              height: 44, background: "none", border: "none", cursor: "pointer", fontSize: 14,
              fontWeight: tab === key ? 500 : 400, color: tab === key ? "var(--c-ink)" : "var(--c-mid)",
              borderBottom: tab === key ? "1.5px solid var(--c-ink)" : "1px solid var(--c-rule)",
            }}>
            {label}{key === "first" && status === "ready" ? ` · ${unreviewed.length}` : ""}
          </button>
        ))}
      </div>

      {tab === "first" && (
        <div style={{ margin: "0 24px 16px", padding: "16px 18px", border: "1px dashed var(--c-rule)", borderRadius: 2, display: "flex", flexDirection: "column", gap: 10 }}>
          <span className="t-title" style={{ fontSize: 20, lineHeight: 1.2 }}>
            {progress.count === 0 ? "Be the first to log a cup somewhere" : `You were first at ${progress.count} ${progress.count === 1 ? "café" : "cafés"}`}
          </span>
          <span className="t-meta" style={{ fontSize: 13, lineHeight: 1.5 }}>
            {progress.next
              ? `${progress.toNext} more ${progress.toNext === 1 ? "first" : "firsts"} for the ${progress.next.name} badge. The café page will say you found it.`
              : "Every first-reviewer badge collected. Legendary."}
          </span>
          <FirstBadgeRow count={progress.count} />
        </div>
      )}

      {(status === "locating" || status === "loading") && (
        <p className="t-meta" style={{ padding: "0 24px" }}>{status === "locating" ? "finding where you are…" : "finding cafés around you…"}</p>
      )}
      {status === "no-location" && (
        <p className="t-meta" style={{ padding: "0 24px", lineHeight: 1.5 }}>Turn on location to see every café around you, including ones nobody has logged yet.</p>
      )}
      {status === "error" && <p className="t-meta" style={{ padding: "0 24px" }}>Couldn’t load cafés near you — try again in a bit.</p>}
      {status === "ready" && list.length === 0 && (
        <p className="t-meta" style={{ padding: "0 24px" }}>
          {tab === "first" ? "Every café around here has been logged. Try the map further out." : "No cafés found around here yet."}
        </p>
      )}

      {status === "ready" && list.length > 0 && view === "map" && here && restored && (
        <div style={{ margin: "0 12px" }}>
          <div style={{ position: "relative" }}>
            <CafeMap key={mapKey} center={here} pins={pins} camera={camera} onCameraChange={onCamera} selectedId={selectedId} onSelect={setSelectedId} height={460} />
            {(moved || searching) && (
              <button type="button" onClick={searchHere} disabled={searching}
                style={{
                  position: "absolute", top: 12, left: "50%", transform: "translateX(-50%)", zIndex: 3,
                  padding: "9px 16px", borderRadius: 999, border: "1px solid var(--c-rule)", cursor: "pointer",
                  background: "var(--c-paper)", color: "var(--c-ink)", fontSize: 13, fontWeight: 500,
                  boxShadow: "0 4px 12px rgba(28,20,16,.14)", whiteSpace: "nowrap",
                }}>
                {searching ? "searching…" : "search this area"}
              </button>
            )}
            {selected && <PreviewCard place={selected} onClose={() => setSelectedId(null)} />}
          </div>
          <p className="t-meta" style={{ fontSize: 11, padding: "6px 12px 0" }}>
            {selected ? "" : "Tap a pin for a preview. "}Map © OpenFreeMap · © OpenMapTiles · data © OpenStreetMap contributors
          </p>
        </div>
      )}

      {status === "ready" && list.length > 0 && view === "list" && (
        <ul style={{ listStyle: "none", padding: "0 24px" }}>
          {shown.map(p => {
            const reviewed = isReviewed(p)
            const meta = metaLine(p)
            return (
              <li key={p.id}>
                <Link href={`/place/${p.id}`} style={{ display: "grid", gridTemplateColumns: "52px 1fr auto", gap: 14, alignItems: "center", padding: "12px 0", borderBottom: "1px solid var(--c-rule)" }}>
                  <span aria-hidden="true" className={reviewed ? "t-score" : "t-display"} style={{
                    height: 52, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 2,
                    fontSize: reviewed ? 22 : 26, fontStyle: reviewed ? undefined : "italic",
                    color: reviewed ? "var(--c-ink)" : "var(--c-mid)",
                    background: reviewed ? "var(--c-paper)" : "var(--c-tint)", border: reviewed ? "1px solid var(--c-rule)" : "none",
                  }}>
                    {reviewed ? formatScore(p.avg_score) : p.name.trim()[0]?.toLowerCase()}
                  </span>
                  <span style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
                    <span className="t-title" style={{ fontSize: 19, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</span>
                    {meta && <span className="t-meta" style={{ fontSize: 12 }}>{meta}</span>}
                    <span style={{ fontSize: 12, color: reviewed ? "var(--c-mid)" : "var(--c-ink)" }}>
                      {reviewed ? `${p.review_count} ${p.review_count === 1 ? "cup" : "cups"} logged` : "no cups yet · be the first"}
                    </span>
                  </span>
                  <span className="t-label" style={{ flexShrink: 0 }}>{formatDistance(p.distance_m)}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
      {status === "ready" && view === "list" && list.length > 10 && !expanded && (
        <button type="button" className="t-label" onClick={() => setExpanded(true)}
          style={{ display: "block", margin: "8px auto 0", minHeight: 44, background: "none", border: "none", cursor: "pointer" }}>
          show all {list.length}
        </button>
      )}
    </section>
  )
}

/** The café you tapped on the map: name, what it is, its score or "be the first". */
function PreviewCard({ place, onClose }: { place: CatalogPlace; onClose: () => void }) {
  const reviewed = isReviewed(place)
  const meta = [metaLine(place), formatDistance(place.distance_m)].filter(Boolean).join(" · ")
  return (
    <div style={{ position: "absolute", left: 10, right: 10, bottom: 10, zIndex: 3, background: "var(--c-paper)", border: "1px solid var(--c-rule)", borderRadius: 2, boxShadow: "0 6px 18px rgba(28,20,16,.16)", display: "flex", alignItems: "stretch" }}>
      <Link href={`/place/${place.id}`} style={{ flexGrow: 1, minWidth: 0, display: "grid", gridTemplateColumns: "48px 1fr", gap: 12, alignItems: "center", padding: "12px 4px 12px 12px" }}>
        <span aria-hidden="true" className={reviewed ? "t-score" : "t-display"} style={{
          height: 48, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 2,
          fontSize: reviewed ? 20 : 24, fontStyle: reviewed ? undefined : "italic",
          color: reviewed ? "var(--c-ink)" : "var(--c-mid)", background: reviewed ? "var(--c-paper)" : "var(--c-tint)",
          border: reviewed ? "1px solid var(--c-rule)" : "none",
        }}>
          {reviewed ? formatScore(place.avg_score) : place.name.trim()[0]?.toLowerCase()}
        </span>
        <span style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
          <span className="t-title" style={{ fontSize: 19, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{place.name}</span>
          {meta && <span className="t-meta" style={{ fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{meta}</span>}
          <span style={{ fontSize: 12, color: "var(--c-ink)" }}>
            {reviewed ? `${place.review_count} ${place.review_count === 1 ? "cup" : "cups"} logged · open →` : "no cups yet · be the first →"}
          </span>
        </span>
      </Link>
      <button type="button" aria-label="Close preview" onClick={onClose}
        style={{ width: 44, flexShrink: 0, background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "var(--c-mid)" }}>×</button>
    </div>
  )
}
