"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { createClient } from "@niche/auth/client"
import {
  formatDistance, getCurrentPosition, importFoundPlace, searchPlaces, searchPlacesByName,
  type CatalogPlace, type FoundPlace, type LatLng, type LovedPlace,
} from "@niche/database"
import type { Place } from "@niche/shared-types"
import { PageTitle, SearchField, SectionHeading } from "@/components/ui/Primitives"
import { SleepyPearl } from "@/components/ui/Doodles"
import { APP_ID, formatScore, isHomePlace } from "@/lib/boba"
import NearYou, { type NearStatus } from "./NearYou"

const FILTERS = [
  { key: "all", label: "everything", match: () => true },
  { key: "milk", label: "milk tea", match: (c: string) => c === "milk tea" },
  { key: "brown", label: "brown sugar", match: (c: string) => c === "brown sugar" },
  { key: "fruit", label: "fruit tea", match: (c: string) => c === "fruit tea" },
  { key: "matcha", label: "matcha", match: (c: string) => c === "matcha" },
  { key: "taro", label: "taro", match: (c: string) => c === "taro" },
] as const

function friendsLine(friends: string[]) {
  if (friends.length === 0) return ""
  if (friends.length <= 2) return friends.join(" and ")
  return `${friends.slice(0, 2).join(", ")} and ${friends.length - 2} more`
}

// Cafés without a photo get their initial set large, not a doodle (doodles stay one per screen).
function PlacePhoto({ photo, name, height }: { photo: string | null; name: string; height: number }) {
  return photo
    ? <img src={photo} alt="" loading="lazy" className="photo" style={{ height }} />
    : (
      <span aria-hidden="true" className="t-display" style={{
        height, display: "flex", alignItems: "center", justifyContent: "center", fontStyle: "italic",
        fontSize: height * 0.45, color: "var(--c-mid)", background: "var(--c-tint)", borderRadius: 18,
      }}>
        {name.trim()[0]?.toLowerCase()}
      </span>
    )
}

export default function ExploreClient({ places }: { places: LovedPlace[] }) {
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("all")
  const [results, setResults] = useState<Place[] | null>(null)
  const [mapResults, setMapResults] = useState<FoundPlace[]>([])
  const [opening, setOpening] = useState<string | null>(null)
  const [here, setHere] = useState<LatLng | null>(null)
  const [nearStatus, setNearStatus] = useState<NearStatus>("locating")
  const [near, setNear] = useState<CatalogPlace[]>([])
  const router = useRouter()

  // Where you are, then every café around it (the server seeds new areas).
  useEffect(() => {
    let cancelled = false
    getCurrentPosition().then(async pos => {
      if (cancelled) return
      if (!pos) { setNearStatus("no-location"); return }
      setHere(pos)
      setNearStatus("loading")
      try {
        const res = await fetch(`/api/places/near?lat=${pos.lat}&lng=${pos.lng}`)
        if (!res.ok) throw new Error(String(res.status))
        const body: { places: CatalogPlace[] } = await res.json()
        if (!cancelled) { setNear(body.places); setNearStatus("ready") }
      } catch {
        if (!cancelled) setNearStatus("error")
      }
    })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) { setResults(null); setMapResults([]); return }
    const ctrl = new AbortController()
    const t = setTimeout(async () => {
      const found = await searchPlaces(createClient(), { app_id: APP_ID, query: q }).catch(() => [])
      if (ctrl.signal.aborted) return
      setResults(found.filter(p => !isHomePlace(p)))
      // Then cafés on the map that nobody has logged yet.
      if (q.length >= 3) {
        const onMap = await searchPlacesByName(q, here, { signal: ctrl.signal }).catch(() => [])
        const known = new Set(found.map(p => p.google_place_id).filter(Boolean))
        if (!ctrl.signal.aborted) setMapResults(onMap.filter(p => !known.has(p.google_place_id)))
      }
    }, 300)
    return () => { clearTimeout(t); ctrl.abort() }
  }, [query, here])

  const openFound = async (p: FoundPlace) => {
    setOpening(p.google_place_id)
    const id = await importFoundPlace(createClient(), { app_id: APP_ID, place: p }).catch(() => null)
    if (id) router.push(`/place/${id}`)
    else setOpening(null)
  }

  const shown = useMemo(() => {
    const f = FILTERS.find(x => x.key === filter)!
    return filter === "all" ? places : places.filter(p => p.categories.some(c => f.match(c.toLowerCase())))
  }, [places, filter])

  const [featured, ...rest] = shown
  const fromFriends = places.some(p => p.friends.length > 0)

  return (
    <div>
      <PageTitle>explore</PageTitle>
      <div style={{ padding: "16px 24px 0" }}>
        <SearchField id="q" label="Search shops" value={query} onChange={setQuery} placeholder="search shops" />
      </div>

      {results ? (
        <section style={{ padding: "8px 24px 0" }}>
          {results.length === 0 && mapResults.length === 0 && (
            <p className="t-meta" style={{ padding: "18px 0" }}>No shops called “{query.trim()}” found.</p>
          )}
          {results.map(p => (
            <Link key={p.id} href={`/place/${p.id}`} style={{ display: "flex", alignItems: "baseline", gap: 12, padding: "16px 0", borderBottom: "1px solid var(--c-rule)" }}>
              <span className="t-title" style={{ fontSize: 22, flexGrow: 1 }}>{p.name}</span>
              <span className="t-meta">{p.review_count} {p.review_count === 1 ? "sip" : "sips"}</span>
              {p.avg_score != null && <span className="t-score" style={{ fontSize: 22 }}>{formatScore(p.avg_score)}</span>}
            </Link>
          ))}
          {mapResults.length > 0 && (
            <>
              <p className="t-label" style={{ padding: "22px 0 4px" }}>not on boba! yet</p>
              {mapResults.map(p => (
                <button key={p.google_place_id} type="button" onClick={() => openFound(p)} disabled={opening === p.google_place_id}
                  style={{ width: "100%", display: "flex", alignItems: "baseline", gap: 12, padding: "14px 0", textAlign: "left", background: "none", border: "none", borderBottom: "1px solid var(--c-rule)", cursor: "pointer" }}>
                  <span style={{ display: "flex", flexDirection: "column", gap: 2, flexGrow: 1, minWidth: 0 }}>
                    <span className="t-title" style={{ fontSize: 20 }}>{p.name}</span>
                    <span className="t-meta" style={{ fontSize: 12 }}>{[p.address, p.city].filter(Boolean).join(", ") || "no sips yet"}</span>
                  </span>
                  <span className="t-label" style={{ flexShrink: 0 }}>{opening === p.google_place_id ? "opening…" : formatDistance(p.distance) || "be the first"}</span>
                </button>
              ))}
            </>
          )}
        </section>
      ) : (
        <>
          <NearYou here={here} status={nearStatus} places={near} />

          <div style={{ display: "flex", gap: 8, padding: "30px 24px 0", overflowX: "auto" }}>
            {FILTERS.map(f => (
              <button key={f.key} type="button" className="pill" aria-pressed={filter === f.key} onClick={() => setFilter(f.key)}>{f.label}</button>
            ))}
          </div>

          <SectionHeading>{fromFriends ? "shops your friends love" : "popular on boba!"}</SectionHeading>

          {!featured ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "30px 40px 0", textAlign: "center" }}>
              <SleepyPearl size={110} />
              <p className="t-meta" style={{ fontSize: 14 }}>
                {places.length === 0 ? "No shops yet — log a drink and yours will be the first." : "Nothing matches that filter yet."}
              </p>
            </div>
          ) : (
            <>
              <Link href={`/place/${featured.place.id}`} style={{ display: "flex", flexDirection: "column", gap: 12, margin: "0 12px" }}>
                <PlacePhoto photo={featured.photo} name={featured.place.name} height={250} />
                <span style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12, padding: "0 12px" }}>
                  <span style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <span className="t-display" style={{ fontSize: 32, lineHeight: 1 }}>{featured.place.name}</span>
                    <span className="t-meta">{[featured.place.city, friendsLine(featured.friends)].filter(Boolean).join(" · ")}</span>
                  </span>
                  <span className="t-score" style={{ fontSize: 32 }}>{formatScore(featured.avg_score)}</span>
                </span>
              </Link>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 16, padding: "24px 24px 0" }}>
                {rest.map(p => (
                  <Link key={p.place.id} href={`/place/${p.place.id}`} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <PlacePhoto photo={p.photo} name={p.place.name} height={150} />
                    <span style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                      <span className="t-title" style={{ fontSize: 20 }}>{p.place.name}</span>
                      <span className="t-score" style={{ fontSize: 20 }}>{formatScore(p.avg_score)}</span>
                    </span>
                    <span style={{ fontSize: 12, color: "var(--c-mid)" }}>{[p.place.city, friendsLine(p.friends)].filter(Boolean).join(" · ")}</span>
                  </Link>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
