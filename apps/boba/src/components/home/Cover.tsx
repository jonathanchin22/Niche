import Link from "next/link"
import type { Review } from "@niche/shared-types"
import { DrinkDoodle, Sparkle } from "@/components/ui/Doodles"
import { Avatar, Score } from "@/components/ui/Primitives"
import { formatScore, placeLabel, tasteChips, timeAgo, type Cup } from "@/lib/boba"

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

const COVER_CAPTION = { today: "sip of the day", week: "sip of the week", earlier: "from the archive" } as const

/** The featured sip, set like a magazine cover: photo, then the order and the score. */
export function CoverStory({ review, when = "today" }: { review: Review; when?: keyof typeof COVER_CAPTION }) {
  const r = review as Cup
  const photo = r.image_urls?.[0]
  const name = r.item_name ?? r.category ?? "a boba"
  const chips = tasteChips(r)
  return (
    <Link
      href={`/review/${r.id}`}
      aria-label={`${COVER_CAPTION[when]}: ${name}, ${formatScore(r.score)}, from ${r.user?.username ?? "a friend"}`}
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
          {COVER_CAPTION[when]} · via {r.user?.username ?? "a friend"}
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

/** One sip in the feed: who and when, then the photo (or a big score), the order and the note. */
function FeedEntry({ review }: { review: Review }) {
  const r = review as Cup & { upvotes_count?: number; comments_count?: number }
  const photo = r.image_urls?.[0]
  const name = r.item_name ?? r.category ?? "a boba"
  const by = r.user?.username ?? ""
  const chips = tasteChips(r).slice(0, 3)
  const cheers = r.upvotes_count ?? 0
  const comments = r.comments_count ?? 0

  const byline = (
    <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <Avatar user={r.user} size={24} />
      <span style={{ fontSize: 13, fontWeight: 600 }}>{by}</span>
      <span className="t-label">{timeAgo(r.created_at)}</span>
    </span>
  )
  const extras = (
    <>
      {chips.length > 0 && (
        <span style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 2 }}>
          {chips.map(c => <span key={c} className="taste">{c}</span>)}
        </span>
      )}
      {r.note && <span className="t-hand clamp-2" style={{ fontSize: 22 }}>“{r.note}”</span>}
      {(cheers > 0 || comments > 0) && (
        <span className="t-label">
          {[cheers > 0 && `${cheers} ${cheers === 1 ? "cheer" : "cheers"}`, comments > 0 && `${comments} ${comments === 1 ? "comment" : "comments"}`].filter(Boolean).join(" · ")}
        </span>
      )}
    </>
  )

  if (!photo) {
    return (
      <Link href={`/review/${r.id}`} aria-label={`${name} from ${by}, ${formatScore(r.score)}`}
        style={{ display: "grid", gridTemplateColumns: "92px 1fr", gap: 16, padding: "0 20px" }}>
        <span className="t-score" style={{
          height: 92, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 42,
          background: "var(--c-paper)", border: "1px solid var(--c-rule)", borderRadius: 18,
        }}>{formatScore(r.score)}</span>
        <span style={{ display: "flex", flexDirection: "column", gap: 5, minWidth: 0 }}>
          {byline}
          <span className="t-title" style={{ fontSize: 21 }}>{name}</span>
          <span className="t-meta">{placeLabel(r.place)}</span>
          {extras}
        </span>
      </Link>
    )
  }

  return (
    <Link href={`/review/${r.id}`} aria-label={`${name} from ${by}, ${formatScore(r.score)}`} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <span style={{ padding: "0 24px" }}>{byline}</span>
      <img src={photo} alt="" loading="lazy" decoding="async" className="photo" style={{ height: 300, margin: "0 12px", width: "calc(100% - 24px)", borderRadius: 24 }} />
      <span style={{ display: "flex", flexDirection: "column", gap: 5, padding: "0 24px" }}>
        <span style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
          <span className="t-title" style={{ fontSize: 23 }}>{name}</span>
          <span className="t-score" style={{ fontSize: 26 }}>{formatScore(r.score)}</span>
        </span>
        <span className="t-meta">{placeLabel(r.place)}</span>
        {extras}
      </span>
    </Link>
  )
}

const DAY = 86_400_000

/** Friends' sips (and yours), newest first, broken into this week / this month / earlier. */
export function Feed({ reviews }: { reviews: Review[] }) {
  const now = Date.now()
  const week: Review[] = [], month: Review[] = [], older: Review[] = []
  for (const r of reviews) {
    const age = now - new Date(r.created_at).getTime()
    ;(age < 7 * DAY ? week : age < 31 * DAY ? month : older).push(r)
  }
  const groups = [
    { title: "this week", items: week },
    { title: "earlier this month", items: month },
    { title: "before that", items: older },
  ]

  return (
    <section style={{ paddingBottom: 12 }}>
      {groups.filter(g => g.items.length > 0).map(g => (
        <div key={g.title}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", padding: "32px 24px 16px" }}>
            <h2 className="t-section">{g.title}</h2>
            <span className="t-label">{g.items.length} {g.items.length === 1 ? "sip" : "sips"}</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 30 }}>
            {g.items.map(r => <FeedEntry key={r.id} review={r} />)}
          </div>
        </div>
      ))}
      <p className="t-meta" style={{ padding: "36px 24px 0", textAlign: "center" }}>
        That’s everything. <Link href="/friends" style={{ color: "var(--c-jade)", textDecoration: "underline", textUnderlineOffset: 3 }}>Find more people</Link> to fill the page.
      </p>
    </section>
  )
}
