import Link from "next/link"
import type { Review } from "@niche/shared-types"
import { DrinkDoodle, Sparkle } from "@/components/ui/Doodles"
import { Score } from "@/components/ui/Primitives"
import { formatScore, isHomePlace, placeLabel, type Cup } from "@/lib/brew"

export function Masthead({ issue, date }: { issue: number; date: string }) {
  return (
    <header style={{ height: 56, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 20px 0" }}>
      <span style={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontSize: 26, letterSpacing: "-0.01em" }}>brew.</span>
      <span className="t-label" style={{ letterSpacing: "0.16em" }}>no. {issue} — {date}</span>
    </header>
  )
}

/** The cup of the day, set like a magazine cover: photo, then caption in ink. */
export function CoverStory({ review }: { review: Review }) {
  const r = review as Cup
  const photo = r.image_urls?.[0]
  const name = r.item_name ?? r.category ?? "a cup"
  return (
    <Link
      href={`/review/${r.id}`}
      aria-label={`Cup of the day: ${name}, ${formatScore(r.score)}, from ${r.user?.username ?? "a friend"}`}
      style={{ display: "flex", flexDirection: "column", gap: 14, margin: "0 12px" }}
    >
      {photo
        ? <img src={photo} alt="" className="photo" style={{ height: 360 }} />
        : (
          <span style={{ height: 300, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--c-paper)", border: "1px solid var(--c-rule)", borderRadius: 2 }}>
            <DrinkDoodle category={r.category} itemName={r.item_name} atHome={isHomePlace(r.place)} size={190} />
          </span>
        )}
      <span style={{ display: "flex", flexDirection: "column", gap: 6, padding: "0 12px" }}>
        <span className="t-label" style={{ display: "flex", alignItems: "center", gap: 6, letterSpacing: "0.16em" }}>
          {photo && <Sparkle />}
          cup of the day · via {r.user?.username ?? "a friend"}
        </span>
        <span style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12 }}>
          <span className="t-display" style={{ fontSize: 50 }}>{name}</span>
          <Score value={r.score} />
        </span>
        <span className="t-meta">{placeLabel(r.place)}</span>
      </span>
    </Link>
  )
}

/** One tile in "this week, among friends": a photo, a handwritten note, or a doodle. */
function WeekTile({ review, tall }: { review: Review; tall: boolean }) {
  const r = review as Cup
  const photo = r.image_urls?.[0]
  const name = r.item_name ?? r.category ?? "a cup"
  const by = r.user?.username ?? ""

  if (!photo && r.note) {
    return (
      <Link href={`/review/${r.id}`} aria-label={`${name} from ${by}: ${r.note}`} style={{
        display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 14, minHeight: 124,
        padding: 14, background: "var(--c-paper)", border: "1px solid var(--c-rule)", borderRadius: 2,
      }}>
        <span className="t-hand clamp-2" style={{ fontSize: 22 }}>“{r.note}”</span>
        <span className="t-label">{by} · {name}</span>
      </Link>
    )
  }

  return (
    <Link href={`/review/${r.id}`} aria-label={`${name} from ${by}, ${formatScore(r.score)}`} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {photo
        ? <img src={photo} alt="" loading="lazy" className="photo" style={{ height: tall ? 190 : 150 }} />
        : (
          <span className="t-display" style={{ height: tall ? 190 : 150, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 56, background: "var(--c-paper)", border: "1px solid var(--c-rule)", borderRadius: 2 }}>
            {formatScore(r.score)}
          </span>
        )}
      <span style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
        <span className="t-title" style={{ fontSize: 18 }}>{name}</span>
        <span className="t-score" style={{ fontSize: 18 }}>{formatScore(r.score)}</span>
      </span>
      <span style={{ fontSize: 12, color: "var(--c-mid)", marginTop: -4 }}>{by}</span>
    </Link>
  )
}

export function WeekAmongFriends({ reviews }: { reviews: Review[] }) {
  const left = reviews.filter((_, i) => i % 2 === 0)
  const right = reviews.filter((_, i) => i % 2 === 1)
  return (
    <section>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", padding: "26px 24px 14px" }}>
        <h2 className="t-section">this week, among friends</h2>
        <span className="t-label">{reviews.length} {reviews.length === 1 ? "cup" : "cups"}</span>
      </div>
      {reviews.length === 0 ? (
        <p className="t-meta" style={{ padding: "0 24px" }}>
          A quiet week so far. <Link href="/friends" style={{ color: "var(--c-ink)", textDecoration: "underline", textUnderlineOffset: 3 }}>Find more people</Link> to fill this page.
        </p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12, padding: "0 24px", alignItems: "start" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {left.map((r, i) => <WeekTile key={r.id} review={r} tall={i % 2 === 0} />)}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {right.map((r, i) => <WeekTile key={r.id} review={r} tall={i % 2 === 1} />)}
          </div>
        </div>
      )}
      {reviews.length > 0 && (
        <Link href="/friends" className="t-label" style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 44, marginTop: 12, color: "var(--c-ink)" }}>
          all friend activity →
        </Link>
      )}
    </section>
  )
}
