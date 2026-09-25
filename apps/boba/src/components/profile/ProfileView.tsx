import Link from "next/link"
import { byPersonalRank, getFollowing, getSavedReviews, getUserReviews, getUserStats } from "@niche/database"
import BackButton from "@/components/ui/BackButton"
import { SleepyPearl } from "@/components/ui/Doodles"
import { Avatar, CupTile, PlusIcon } from "@/components/ui/Primitives"
import { APP_ID, formatScore, iceLabel, isHomePlace, type Cup, type CupPlace, type Profile } from "@/lib/boba"
import type { createServerSupabaseClient } from "@niche/auth/server"
import FollowButton from "./FollowButton"
import SafetyMenu from "@/components/safety/SafetyMenu"

type Tab = "cups" | "ranked" | "try" | "cafes"

export default async function ProfileView({ supabase, viewerId, profile, tab, isFollowing, isBlocked }: {
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>
  viewerId: string
  profile: Profile
  tab: Tab
  isFollowing?: boolean
  isBlocked?: boolean
}) {
  const isOwn = viewerId === profile.id
  const activeTab: Tab = tab === "try" && !isOwn ? "cups" : tab
  const base = isOwn ? "/profile" : `/profile/${profile.username}`

  const [stats, following, reviewsPage, saved] = await Promise.all([
    getUserStats(supabase, { user_id: profile.id, app_id: APP_ID }),
    getFollowing(supabase, profile.id),
    getUserReviews(supabase, { user_id: profile.id, app_id: APP_ID, limit: 60 }).catch(() => ({ data: [] })),
    isOwn && activeTab === "try" ? getSavedReviews(supabase, { user_id: profile.id, app_id: APP_ID }).catch(() => []) : Promise.resolve([]),
  ])
  const reviews = reviewsPage.data.map(i => i.review).filter(Boolean) as Cup[]

  const tabs: { key: Tab; label: string }[] = [
    { key: "cups", label: "sips" },
    { key: "ranked", label: "ranked" },
    ...(isOwn ? [{ key: "try" as const, label: "want to try" }] : []),
    { key: "cafes", label: "shops" },
  ]

  const usual = usualOrder(reviews)
  const tagline = [`@${profile.username}`, stats.top_category ? `${stats.top_category} loyalist` : null].filter(Boolean).join(" · ")

  return (
    <div>
      <div style={{ position: "relative" }}>
        {!isOwn && <div style={{ position: "absolute", top: 48, left: 16 }}><BackButton /></div>}
        {!isOwn && (
          <div style={{ position: "absolute", top: 48, right: 12 }}>
            <SafetyMenu viewerId={viewerId} target={{ id: profile.id, username: profile.username }} noun="sip" />
          </div>
        )}
        {isOwn && (
          <Link href="/settings" aria-label="Settings" style={{ position: "absolute", top: 48, right: 12, width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <circle cx="10" cy="10" r="2.6" stroke="currentColor" strokeWidth="1.4" />
              <path d="M10 1.8 V4.2M10 15.8 V18.2M1.8 10 H4.2M15.8 10 H18.2M4.2 4.2 L5.9 5.9M14.1 14.1 L15.8 15.8M4.2 15.8 L5.9 14.1M14.1 5.9 L15.8 4.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </Link>
        )}
      </div>

      <header style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: "72px 24px 0", textAlign: "center" }}>
        <Avatar user={profile} size={76} />
        <h1 className="t-display" style={{ fontSize: 38, lineHeight: 1, marginTop: 4 }}>{profile.display_name}</h1>
        <span className="t-label">{tagline}</span>
        {profile.bio && <p className="t-hand" style={{ fontSize: 21, color: "var(--c-mid)", marginTop: 2 }}>“{profile.bio}”</p>}
        {!isOwn && !isBlocked && <div style={{ marginTop: 8 }}><FollowButton viewerId={viewerId} targetId={profile.id} initialFollowing={!!isFollowing} /></div>}
        {!isOwn && isBlocked && (
          <p className="t-meta" style={{ marginTop: 8 }}>
            You blocked @{profile.username}. <Link href="/settings" style={{ textDecoration: "underline", textUnderlineOffset: 3 }}>Unblock in settings</Link>
          </p>
        )}
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", margin: "22px 24px 0", padding: "14px 0", borderTop: "1px solid var(--c-rule)", borderBottom: "1px solid var(--c-rule)", textAlign: "center" }}>
        {[
          { n: String(stats.cups), label: stats.cups === 1 ? "sip" : "sips" },
          { n: String(stats.cafes), label: stats.cafes === 1 ? "shop" : "shops" },
          { n: stats.avg_score == null ? "–" : formatScore(stats.avg_score), label: "avg", italic: true },
          { n: String(following.length), label: "following", href: isOwn ? "/friends" : undefined },
        ].map(s => {
          const body = (
            <>
              <span className="t-title" style={{ fontSize: 26, lineHeight: 1, fontStyle: s.italic ? "italic" : undefined }}>{s.n}</span>
              <span style={{ fontSize: 12, color: "var(--c-mid)" }}>{s.label}</span>
            </>
          )
          return s.href
            ? <Link key={s.label} href={s.href} style={{ display: "flex", flexDirection: "column", gap: 2 }}>{body}</Link>
            : <span key={s.label} style={{ display: "flex", flexDirection: "column", gap: 2 }}>{body}</span>
        })}
      </div>

      {usual && (
        <p style={{ margin: "14px 24px 0", display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6, justifyContent: "center" }}>
          <span className="t-label" style={{ marginRight: 2 }}>{isOwn ? "your usual" : "their usual"}</span>
          {usual.map(u => <span key={u} className="taste">{u}</span>)}
        </p>
      )}

      <nav aria-label="Profile sections" style={{ display: "grid", gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))`, margin: "10px 24px 12px" }}>
        {tabs.map(t => (
          <Link key={t.key} href={t.key === "cups" ? base : `${base}?tab=${t.key}`} aria-current={activeTab === t.key ? "page" : undefined}
            style={{
              height: 44, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14,
              fontWeight: activeTab === t.key ? 600 : 400, color: activeTab === t.key ? "var(--c-ink)" : "var(--c-mid)",
              borderBottom: activeTab === t.key ? "2px solid var(--c-jade)" : "1px solid var(--c-rule)",
            }}>
            {t.label}
          </Link>
        ))}
      </nav>

      {activeTab === "cups" && (
        reviews.length === 0
          ? <EmptyState title="no sips yet" body={isOwn ? "Your first boba starts the grid." : `${profile.display_name} hasn't logged anything on boba! yet.`} action={isOwn ? { href: "/log", label: "log a boba" } : undefined} />
          : <CupGrid reviews={reviews} />
      )}

      {activeTab === "ranked" && (
        reviews.length === 0
          ? <EmptyState title="nothing ranked yet" body={isOwn ? "Log a few sips and compare them — your list builds itself." : `${profile.display_name} hasn't ranked anything yet.`} />
          : <RankedList reviews={reviews} />
      )}

      {activeTab === "try" && (
        saved.length === 0
          ? <EmptyState title="nothing saved yet" body="Tap want to try on any friend's drink and it'll wait for you here." action={{ href: "/explore", label: "find something good" }} />
          : <CupGrid reviews={saved} />
      )}

      {activeTab === "cafes" && <PlaceList reviews={reviews} />}
    </div>
  )
}

/** The most common sugar, ice and top two toppings across someone's logs. */
function usualOrder(reviews: Cup[]) {
  const mode = <T,>(values: T[]) => {
    const counts = new Map<T, number>()
    for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1)
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).map(([v]) => v)
  }
  const sugar = mode(reviews.map(r => r.taste_attributes?.sugar_level).filter((v): v is NonNullable<typeof v> => v != null))[0]
  const ice = mode(reviews.map(r => r.taste_attributes?.ice_level).filter((v): v is NonNullable<typeof v> => !!v))[0]
  const toppings = mode(reviews.flatMap(r => r.toppings ?? []).filter(t => t !== "no topping")).slice(0, 2)
  const out = [
    ...(sugar != null ? [`${sugar}% sugar`] : []),
    ...(ice ? [iceLabel(ice)] : []),
    ...toppings,
  ]
  return out.length > 0 ? out : null
}

function CupGrid({ reviews }: { reviews: Cup[] }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gridAutoRows: 124, gridAutoFlow: "dense", gap: 6, padding: "0 12px" }}>
      {reviews.map((r, i) => (
        <div key={r.id} style={{ gridRow: i % 9 === 0 ? "span 2" : undefined, gridColumn: i % 9 === 5 ? "span 2" : undefined }}>
          <CupTile review={r} />
        </div>
      ))}
    </div>
  )
}

/** Their sips best first, by their own head-to-head comparisons (score breaks ties). */
function RankedList({ reviews }: { reviews: Cup[] }) {
  const ranked = [...reviews].sort(byPersonalRank)
  return (
    <ol style={{ listStyle: "none", padding: "0 24px" }}>
      {ranked.map((r, i) => (
        <li key={r.id}>
          <Link href={`/review/${r.id}`} style={{ display: "grid", gridTemplateColumns: "36px 1fr auto", alignItems: "baseline", gap: 10, padding: "14px 0", borderBottom: "1px solid var(--c-rule)" }}>
            <span className="t-score" style={{ fontSize: i < 3 ? 26 : 20, color: i < 3 ? "var(--c-jade)" : "var(--c-mid)" }}>{i + 1}</span>
            <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
              <span className="t-title" style={{ fontSize: 20 }}>{r.item_name ?? r.category ?? "a sip"}</span>
              <span className="t-meta" style={{ fontSize: 12 }}>{isHomePlace(r.place) ? "made at home" : r.place?.name ?? ""}</span>
            </span>
            <span className="t-score" style={{ fontSize: 20 }}>{formatScore(r.score)}</span>
          </Link>
        </li>
      ))}
    </ol>
  )
}

function PlaceList({ reviews }: { reviews: Cup[] }) {
  const byPlace = new Map<string, { place: CupPlace; scores: number[] }>()
  for (const r of reviews) {
    if (!r.place) continue
    const entry = byPlace.get(r.place_id) ?? { place: r.place, scores: [] as number[] }
    entry.scores.push(Number(r.score))
    byPlace.set(r.place_id, entry)
  }
  const places = [...byPlace.values()].sort((a, b) => b.scores.length - a.scores.length)
  if (places.length === 0) return <EmptyState title="no shops yet" body="Shops show up here once there are drinks logged at them." />

  return (
    <section style={{ padding: "0 24px" }}>
      {places.map(({ place, scores }) => {
        const avg = scores.reduce((a, b) => a + b, 0) / scores.length
        const home = isHomePlace(place)
        const row = (
          <>
            <span className="t-title" style={{ fontSize: 22, flexGrow: 1 }}>{home ? "made at home" : place.name}</span>
            <span style={{ fontSize: 12, color: "var(--c-mid)" }}>{scores.length} {scores.length === 1 ? "sip" : "sips"}</span>
            <span className="t-score" style={{ fontSize: 22, width: 40, textAlign: "right" }}>{formatScore(avg)}</span>
          </>
        )
        const style = { display: "flex", alignItems: "baseline", gap: 12, padding: "16px 0", borderBottom: "1px solid var(--c-rule)" } as const
        return home
          ? <div key={place.id} style={style}>{row}</div>
          : <Link key={place.id} href={`/place/${place.id}`} style={style}>{row}</Link>
      })}
    </section>
  )
}

function EmptyState({ title, body, action }: { title: string; body: string; action?: { href: string; label: string } }) {
  return (
    <section style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, padding: "48px 40px 0", textAlign: "center" }}>
      <SleepyPearl size={120} />
      <h2 className="t-display" style={{ fontSize: 30, lineHeight: 1.05 }}>{title}</h2>
      <p className="t-meta" style={{ fontSize: 14, lineHeight: 1.5 }}>{body}</p>
      {action && (
        <Link href={action.href} className="btn btn-secondary btn-sm" style={{ marginTop: 8 }}>
          {action.href === "/log" && <PlusIcon size={14} />}{action.label}
        </Link>
      )}
    </section>
  )
}
