import Link from "next/link"
import type { Review } from "@niche/shared-types"
import { DrinkDoodle, Sparkle } from "@/components/ui/Doodles"
import { Avatar, Score } from "@/components/ui/Primitives"
import { formatScore, isHomePlace, placeLabel, timeAgo, type Cup } from "@/lib/brew"

export function Masthead({ issue, date }: { issue: number; date: string }) {
  return (
    <header style={{ height: 56, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 20px 0" }}>
      <span style={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontSize: 26, letterSpacing: "-0.01em" }}>brew.</span>
      <span className="t-label" style={{ letterSpacing: "0.16em" }}>no. {issue} — {date}</span>
    </header>
  )
}

const COVER_CAPTION = { today: "cup of the day", week: "cup of the week", earlier: "from the archive" } as const

/** The featured cup, set like a magazine cover: photo, then caption in ink. */
export function CoverStory({ review, when = "today" }: { review: Review; when?: keyof typeof COVER_CAPTION }) {
  const r = review as Cup
  const photo = r.image_urls?.[0]
  const name = r.item_name ?? r.category ?? "a cup"
  return (
    <Link
      href={`/review/${r.id}`}
      aria-label={`${COVER_CAPTION[when]}: ${name}, ${formatScore(r.score)}, from ${r.user?.username ?? "a friend"}`}
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
          {COVER_CAPTION[when]} · via {r.user?.username ?? "a friend"}
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

/** One cup in the feed: who and when, then the photo (or a big score), the drink and the note. */
function FeedEntry({ review }: { review: Review }) {
  const r = review as Cup & { upvotes_count?: number; comments_count?: number }
  const photo = r.image_urls?.[0]
  const name = r.item_name ?? r.category ?? "a cup"
  const by = r.user?.username ?? ""
  const cheers = r.upvotes_count ?? 0
  const comments = r.comments_count ?? 0

  const byline = (
    <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <Avatar user={r.user} size={24} />
      <span style={{ fontSize: 13, fontWeight: 500 }}>{by}</span>
      <span className="t-label">{timeAgo(r.created_at)}</span>
    </span>
  )
  const social = (cheers > 0 || comments > 0) && (
    <span className="t-label">
      {[cheers > 0 && `${cheers} ${cheers === 1 ? "cheer" : "cheers"}`, comments > 0 && `${comments} ${comments === 1 ? "comment" : "comments"}`].filter(Boolean).join(" · ")}
    </span>
  )

  if (!photo) {
    return (
      <Link href={`/review/${r.id}`} aria-label={`${name} from ${by}, ${formatScore(r.score)}`}
        style={{ display: "grid", gridTemplateColumns: "92px 1fr", gap: 16, padding: "0 24px" }}>
        <span className="t-display" style={{
          height: 92, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 44,
          background: "var(--c-paper)", border: "1px solid var(--c-rule)", borderRadius: 2,
        }}>{formatScore(r.score)}</span>
        <span style={{ display: "flex", flexDirection: "column", gap: 5, minWidth: 0 }}>
          {byline}
          <span className="t-title" style={{ fontSize: 22 }}>{name}</span>
          <span className="t-meta">{placeLabel(r.place)}</span>
          {r.note && <span className="t-hand clamp-2" style={{ fontSize: 21 }}>“{r.note}”</span>}
          {social}
        </span>
      </Link>
    )
  }

  return (
    <Link href={`/review/${r.id}`} aria-label={`${name} from ${by}, ${formatScore(r.score)}`} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <span style={{ padding: "0 24px" }}>{byline}</span>
      <img src={photo} alt="" loading="lazy" decoding="async" className="photo" style={{ height: 300, margin: "0 12px", width: "calc(100% - 24px)" }} />
      <span style={{ display: "flex", flexDirection: "column", gap: 5, padding: "0 24px" }}>
        <span style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
          <span className="t-title" style={{ fontSize: 24 }}>{name}</span>
          <span className="t-score" style={{ fontSize: 26 }}>{formatScore(r.score)}</span>
        </span>
        <span className="t-meta">{placeLabel(r.place)}</span>
        {r.note && <span className="t-hand clamp-2" style={{ fontSize: 22 }}>“{r.note}”</span>}
        {social}
      </span>
    </Link>
  )
}

const DAY = 86_400_000

/** Friends' cups (and yours), newest first, broken into this week / this month / earlier. */
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
            <span className="t-label">{g.items.length} {g.items.length === 1 ? "cup" : "cups"}</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 30 }}>
            {g.items.map(r => <FeedEntry key={r.id} review={r} />)}
          </div>
        </div>
      ))}
      <p className="t-meta" style={{ padding: "36px 24px 0", textAlign: "center" }}>
        That’s everything. <Link href="/friends" style={{ color: "var(--c-ink)", textDecoration: "underline", textUnderlineOffset: 3 }}>Find more people</Link> to fill the page.
      </p>
    </section>
  )
}
