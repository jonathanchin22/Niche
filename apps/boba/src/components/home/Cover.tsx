import Link from "next/link"
import type { Review } from "@niche/shared-types"
import { DrinkDoodle, Sparkle } from "@/components/ui/Doodles"
import { Score } from "@/components/ui/Primitives"
import { formatScore, placeLabel, tasteChips, type Cup } from "@/lib/boba"

export function Wordmark({ size = 28 }: { size?: number }) {
  return (
    <span style={{ fontFamily: "var(--font-display)", fontSize: size, letterSpacing: "-0.02em", lineHeight: 1 }}>
      boba<span className="bang">!</span>
    </span>
  )
}

export function Masthead({ sip, date }: { sip: number; date: string }) {
  return (
    <header style={{ height: 60, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 20px 0" }}>
      <Wordmark />
      <span className="t-label">sip no. {sip} · {date}</span>
    </header>
  )
}

/** The sip of the day, set like a magazine cover: photo, then the order and the score. */
export function CoverStory({ review }: { review: Review }) {
  const r = review as Cup
  const photo = r.image_urls?.[0]
  const name = r.item_name ?? r.category ?? "a boba"
  const chips = tasteChips(r)
  return (
    <Link
      href={`/review/${r.id}`}
      aria-label={`Sip of the day: ${name}, ${formatScore(r.score)}, from ${r.user?.username ?? "a friend"}`}
      style={{ display: "flex", flexDirection: "column", gap: 14, margin: "0 12px" }}
    >
      {photo
        ? <img src={photo} alt="" className="photo" style={{ height: 380, borderRadius: 24 }} />
        : (
          <span style={{ height: 300, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--c-paper)", border: "1px solid var(--c-rule)", borderRadius: 24 }}>
            <DrinkDoodle category={r.category} itemName={r.item_name} size={190} />
          </span>
        )}
      <span style={{ display: "flex", flexDirection: "column", gap: 8, padding: "0 12px" }}>
        <span className="t-label" style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {photo && <Sparkle />}
          sip of the day · via {r.user?.username ?? "a friend"}
        </span>
        <span style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12 }}>
          <span className="t-display" style={{ fontSize: 46 }}>{name}</span>
          <Score value={r.score} />
        </span>
        <span className="t-meta">{placeLabel(r.place)}</span>
        {chips.length > 0 && (
          <span style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 2 }}>
            {chips.map(c => <span key={c} className="taste">{c}</span>)}
          </span>
        )}
      </span>
    </Link>
  )
}

/** One tile in "this week, among friends": a photo, a handwritten note, or a big score. */
function WeekTile({ review, tall }: { review: Review; tall: boolean }) {
  const r = review as Cup
  const photo = r.image_urls?.[0]
  const name = r.item_name ?? r.category ?? "a boba"
  const by = r.user?.username ?? ""

  if (!photo && r.note) {
    return (
      <Link href={`/review/${r.id}`} aria-label={`${name} from ${by}: ${r.note}`} style={{
        display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 14, minHeight: 124,
        padding: 16, background: "var(--c-paper)", border: "1px solid var(--c-rule)", borderRadius: 18,
      }}>
        <span className="t-hand clamp-2" style={{ fontSize: 23 }}>“{r.note}”</span>
        <span className="t-label">{by} · {name}</span>
      </Link>
    )
  }

  return (
    <Link href={`/review/${r.id}`} aria-label={`${name} from ${by}, ${formatScore(r.score)}`} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {photo
        ? <img src={photo} alt="" loading="lazy" className="photo" style={{ height: tall ? 200 : 156 }} />
        : (
          <span className="t-score" style={{ height: tall ? 200 : 156, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 56, background: "var(--c-paper)", border: "1px solid var(--c-rule)", borderRadius: 18 }}>
            {formatScore(r.score)}
          </span>
        )}
      <span style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, padding: "0 2px" }}>
        <span className="t-title" style={{ fontSize: 18 }}>{name}</span>
        <span className="t-score" style={{ fontSize: 18 }}>{formatScore(r.score)}</span>
      </span>
      <span style={{ fontSize: 12, color: "var(--c-mid)", marginTop: -4, padding: "0 2px" }}>{by}</span>
    </Link>
  )
}

export function WeekAmongFriends({ reviews }: { reviews: Review[] }) {
  const left = reviews.filter((_, i) => i % 2 === 0)
  const right = reviews.filter((_, i) => i % 2 === 1)
  return (
    <section>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", padding: "28px 24px 14px" }}>
        <h2 className="t-section">this week, among friends</h2>
        <span className="t-label">{reviews.length} {reviews.length === 1 ? "sip" : "sips"}</span>
      </div>
      {reviews.length === 0 ? (
        <p className="t-meta" style={{ padding: "0 24px" }}>
          A quiet week so far. <Link href="/friends" style={{ color: "var(--c-jade)", textDecoration: "underline", textUnderlineOffset: 3 }}>Find more people</Link> to fill this page.
        </p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12, padding: "0 20px", alignItems: "start" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {left.map((r, i) => <WeekTile key={r.id} review={r} tall={i % 2 === 0} />)}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {right.map((r, i) => <WeekTile key={r.id} review={r} tall={i % 2 === 1} />)}
          </div>
        </div>
      )}
      {reviews.length > 0 && (
        <Link href="/friends" className="t-label" style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 44, marginTop: 12, color: "var(--c-jade)" }}>
          all friend activity →
        </Link>
      )}
    </section>
  )
}
