import Link from "next/link"
import { notFound } from "next/navigation"
import { getServerSession } from "@niche/auth/server"
import { getFirstLog, getFollowing, getPlaceById, getPlaceReviews } from "@niche/database"
import AppShell from "@/components/ui/AppShell"
import BackButton from "@/components/ui/BackButton"
import PlaceMapCard from "@/components/map/PlaceMapCard"
import { CupTile, PlusIcon, SectionHeading } from "@/components/ui/Primitives"
import { formatScore, isHomePlace, type Cup, type Person } from "@/lib/boba"

export default async function PlacePage({ params }: { params: { id: string } }) {
  const { supabase, user } = await getServerSession()
  if (!user) return null

  const [place, items, following, firstLog] = await Promise.all([
    getPlaceById(supabase, params.id),
    getPlaceReviews(supabase, { place_id: params.id, limit: 60 }),
    getFollowing(supabase, user.id),
    getFirstLog(supabase, params.id).catch(() => null),
  ])
  if (!place || isHomePlace(place)) notFound()

  const reviews = items.map(i => i.review).filter(Boolean) as Cup[]
  const circle = new Set([user.id, ...following.map((f: Person) => f.id)])
  const friendCups = reviews.filter(r => circle.has(r.user_id))
  const gridCups = (friendCups.length > 0 ? friendCups : reviews).slice(0, 9)
  const hero = place.cover_image_url ?? reviews.find(r => r.image_urls?.length)?.image_urls[0] ?? null

  // "What to order": drinks logged here, most-logged first.
  const byDrink = new Map<string, { name: string; scores: number[] }>()
  for (const r of reviews) {
    const name = (r.item_name ?? r.category ?? "").trim()
    if (!name) continue
    const key = name.toLowerCase()
    const entry = byDrink.get(key) ?? { name, scores: [] as number[] }
    entry.scores.push(Number(r.score))
    byDrink.set(key, entry)
  }
  const menu = [...byDrink.values()]
    .map(d => ({ name: d.name, cups: d.scores.length, avg: d.scores.reduce((a, b) => a + b, 0) / d.scores.length }))
    .sort((a, b) => b.cups - a.cups || b.avg - a.avg)
    .slice(0, 5)

  const hasCoords = Number(place.lat) !== 0 || Number(place.lng) !== 0
  const fromMap = place.source === "osm" || place.google_place_id?.startsWith("osm_")
  const about = [place.kind === "chain" ? "chain" : null, ...(place.descriptors ?? []).slice(0, 3)].filter(Boolean).join(" · ")
  const firstSip = reviews.length === 0
  const mapsUrl = hasCoords
    ? `https://maps.google.com/?q=${place.lat},${place.lng}`
    : `https://maps.google.com/?q=${encodeURIComponent([place.name, place.city].filter(Boolean).join(" "))}`

  return (
    <AppShell>
      <div style={{ position: "relative" }}>
        {hero
          ? <img src={hero} alt={place.name} style={{ width: "100%", height: 400, objectFit: "cover", background: "var(--c-tint)", borderRadius: "0 0 28px 28px" }} />
          : <div aria-hidden="true" className="t-display" style={{ height: 300, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 160, fontStyle: "italic", color: "var(--c-mid)", background: "var(--c-tint)", borderRadius: "0 0 28px 28px" }}>{place.name.trim()[0]?.toLowerCase()}</div>}
        <div style={{ position: "absolute", top: 52, left: 16 }}><BackButton fallback="/explore" /></div>
      </div>

      <section style={{ display: "flex", flexDirection: "column", gap: 10, padding: "24px 24px 0" }}>
        <span className="t-label">{["shop", place.city].filter(Boolean).join(" · ")}</span>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12 }}>
          <h1 className="t-display" style={{ fontSize: 52 }}>{place.name}</h1>
          {place.avg_score != null && (
            <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2, flexShrink: 0 }}>
              <span className="t-score" style={{ fontSize: 44 }}>{formatScore(place.avg_score)}</span>
              <span style={{ fontSize: 12, color: "var(--c-mid)" }}>{place.review_count} {place.review_count === 1 ? "sip" : "sips"} logged</span>
            </span>
          )}
        </div>
        {(place.address || about) && (
          <span className="t-meta" style={{ fontSize: 13, lineHeight: 1.5 }}>{[place.address, about].filter(Boolean).join(" — ")}</span>
        )}
        {firstLog && (
          <span className="t-label">
            first logged by <Link href={`/profile/${firstLog.username}`} style={{ textDecoration: "underline", textUnderlineOffset: 3 }}>@{firstLog.username}</Link>
          </span>
        )}
      </section>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10, padding: "22px 24px 0" }}>
        <Link href={`/log?place=${place.id}`} className="btn btn-primary" style={{ padding: 0 }}><PlusIcon size={14} />{firstSip ? "log the first sip" : "log a drink here"}</Link>
        <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="btn btn-secondary" style={{ padding: 0 }}>directions ↗</a>
      </div>

      {firstSip && (
        <section style={{ margin: "26px 24px 0", padding: "20px", border: "1.5px dashed var(--c-rule)", borderRadius: 18, display: "flex", flexDirection: "column", gap: 6 }}>
          <span className="t-title" style={{ fontSize: 22 }}>no sips yet</span>
          <span className="t-meta" style={{ fontSize: 14, lineHeight: 1.5 }}>Be the first to log one here. Your drink starts this page, and it’ll say you found it.</span>
        </section>
      )}

      {hasCoords && (
        <div style={{ margin: "26px 24px 0" }}>
          <PlaceMapCard id={place.id} name={place.name} lat={Number(place.lat)} lng={Number(place.lng)} score={place.review_count > 0 && place.avg_score != null ? Number(place.avg_score) : null} />
        </div>
      )}

      {gridCups.length > 0 && (
        <>
          <SectionHeading aside={<span className="t-label">{friendCups.length > 0 ? "you & friends" : "everyone"}</span>}>
            {friendCups.length > 0 ? "friends' sips here" : "sips logged here"}
          </SectionHeading>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gridAutoRows: 124, gap: 6, padding: "0 12px" }}>
            {gridCups.map(r => <CupTile key={r.id} review={r} />)}
          </div>
        </>
      )}

      {menu.length > 0 && (
        <section style={{ padding: "34px 24px 0" }}>
          <h2 className="t-section" style={{ marginBottom: 6 }}>what to order</h2>
          {menu.map(m => (
            <div key={m.name} style={{ display: "flex", alignItems: "baseline", gap: 12, padding: "14px 0", borderBottom: "1px solid var(--c-rule)" }}>
              <span className="t-title" style={{ fontSize: 22 }}>{m.name}</span>
              <span aria-hidden="true" style={{ flexGrow: 1, borderBottom: "1px dotted var(--c-rule)", transform: "translateY(-4px)" }} />
              <span style={{ fontSize: 12, color: "var(--c-mid)" }}>{m.cups} {m.cups === 1 ? "sip" : "sips"}</span>
              <span className="t-score" style={{ fontSize: 22, width: 40, textAlign: "right" }}>{formatScore(m.avg)}</span>
            </div>
          ))}
        </section>
      )}

      {fromMap && <p className="t-meta" style={{ fontSize: 11, padding: "28px 24px 0" }}>Map © OpenFreeMap · © OpenMapTiles · place data © OpenStreetMap contributors</p>}
    </AppShell>
  )
}
