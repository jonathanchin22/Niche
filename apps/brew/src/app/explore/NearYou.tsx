"use client"

import dynamic from "next/dynamic"
import Link from "next/link"
import { useMemo, useState } from "react"
import { formatDistance, type CatalogPlace, type LatLng } from "@niche/database"
import { SectionHeading } from "@/components/ui/Primitives"
import { formatScore } from "@/lib/brew"

// MapLibre is ~200 kB; only load it when someone switches to the map.
const CafeMap = dynamic(() => import("@/components/map/CafeMap"), {
  ssr: false,
  loading: () => <div style={{ height: 420, background: "var(--c-tint)", borderRadius: 2 }} />,
})

const KIND_LABEL: Record<string, string> = { specialty: "specialty", chain: "chain", casual: "café" }

export type NearStatus = "locating" | "loading" | "ready" | "no-location" | "error"

/** Every café around you — reviewed or not — as a list or a map. */
export default function NearYou({ here, status, places }: { here: LatLng | null; status: NearStatus; places: CatalogPlace[] }) {
  const [view, setView] = useState<"list" | "map">("list")
  const [expanded, setExpanded] = useState(false)
  const pins = useMemo(() => places.map(p => ({
    id: p.id, name: p.name, lat: p.lat, lng: p.lng, score: p.review_count > 0 && p.avg_score != null ? p.avg_score : null, href: `/place/${p.id}`,
  })), [places])
  const shown = expanded ? places : places.slice(0, 10)

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

      {(status === "locating" || status === "loading") && (
        <p className="t-meta" style={{ padding: "0 24px" }}>{status === "locating" ? "finding where you are…" : "finding cafés around you…"}</p>
      )}
      {status === "no-location" && (
        <p className="t-meta" style={{ padding: "0 24px", lineHeight: 1.5 }}>Turn on location to see every café around you, including ones nobody has logged yet.</p>
      )}
      {status === "error" && <p className="t-meta" style={{ padding: "0 24px" }}>Couldn’t load cafés near you — try again in a bit.</p>}
      {status === "ready" && places.length === 0 && (
        <p className="t-meta" style={{ padding: "0 24px" }}>No cafés found around here yet.</p>
      )}

      {status === "ready" && places.length > 0 && view === "map" && here && (
        <div style={{ margin: "0 12px" }}>
          <CafeMap center={here} pins={pins} />
          <p className="t-meta" style={{ fontSize: 11, padding: "6px 12px 0" }}>Map © OpenFreeMap · © OpenMapTiles · data © OpenStreetMap contributors</p>
        </div>
      )}

      {status === "ready" && places.length > 0 && view === "list" && (
        <ul style={{ listStyle: "none", padding: "0 24px" }}>
          {shown.map(p => {
            const reviewed = p.review_count > 0 && p.avg_score != null
            const meta = [p.kind ? KIND_LABEL[p.kind] : null, ...p.descriptors.slice(0, 2)].filter(Boolean).join(" · ")
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
      {status === "ready" && view === "list" && places.length > 10 && !expanded && (
        <button type="button" className="t-label" onClick={() => setExpanded(true)}
          style={{ display: "block", margin: "8px auto 0", minHeight: 44, background: "none", border: "none", cursor: "pointer" }}>
          show all {places.length}
        </button>
      )}
    </section>
  )
}
