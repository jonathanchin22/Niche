import Link from "next/link"
import { getFollowing, getSavedReviews, getUserReviews, getUserStats } from "@niche/database"
import BackButton from "@/components/ui/BackButton"
import { SleepyBean } from "@/components/ui/Doodles"
import { Avatar, CupTile, PlusIcon } from "@/components/ui/Primitives"
import { APP_ID, formatScore, isHomePlace, type Cup, type CupPlace, type Profile } from "@/lib/brew"
import type { createServerSupabaseClient } from "@niche/auth/server"
import FollowButton from "./FollowButton"

type Tab = "cups" | "try" | "cafes"

export default async function ProfileView({ supabase, viewerId, profile, tab, isFollowing }: {
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>
  viewerId: string
  profile: Profile
  tab: Tab
  isFollowing?: boolean
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
    { key: "cups", label: "cups" },
    ...(isOwn ? [{ key: "try" as const, label: "want to try" }] : []),
    { key: "cafes", label: "cafés" },
  ]

  const tagline = [`@${profile.username}`, stats.top_category ? `${stats.top_category} loyalist` : null].filter(Boolean).join(" · ")

  return (
    <div>
      <div style={{ position: "relative" }}>
        {!isOwn && <div style={{ position: "absolute", top: 48, left: 16 }}><BackButton /></div>}
        {isOwn && (
          <Link href="/profile/edit" aria-label="Settings" style={{ position: "absolute", top: 48, right: 12, width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center" }}>
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
        {!isOwn && <div style={{ marginTop: 8 }}><FollowButton viewerId={viewerId} targetId={profile.id} initialFollowing={!!isFollowing} /></div>}
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", margin: "22px 24px 0", padding: "14px 0", borderTop: "1px solid var(--c-rule)", borderBottom: "1px solid var(--c-rule)", textAlign: "center" }}>
        {[
          { n: String(stats.cups), label: stats.cups === 1 ? "cup" : "cups" },
          { n: String(stats.cafes), label: stats.cafes === 1 ? "place" : "places" },
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

      <nav aria-label="Profile sections" style={{ display: "grid", gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))`, margin: "10px 24px 12px" }}>
        {tabs.map(t => (
          <Link key={t.key} href={t.key === "cups" ? base : `${base}?tab=${t.key}`} aria-current={activeTab === t.key ? "page" : undefined}
            style={{
              height: 44, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14,
              fontWeight: activeTab === t.key ? 500 : 400, color: activeTab === t.key ? "var(--c-ink)" : "var(--c-mid)",
              borderBottom: activeTab === t.key ? "1.5px solid var(--c-ink)" : "1px solid var(--c-rule)",
            }}>
            {t.label}
          </Link>
        ))}
      </nav>

      {activeTab === "cups" && (
        reviews.length === 0
          ? <EmptyState title="no cups yet" body={isOwn ? "Your first cup starts the grid." : `${profile.display_name} hasn't logged anything on brew yet.`} action={isOwn ? { href: "/log", label: "log a cup" } : undefined} />
          : <CupGrid reviews={reviews} />
      )}

      {activeTab === "try" && (
        saved.length === 0
          ? <EmptyState title="nothing saved yet" body="Tap want to try on any friend's cup and it'll wait for you here." action={{ href: "/explore", label: "find something good" }} />
          : <CupGrid reviews={saved} />
      )}

      {activeTab === "cafes" && <PlaceList reviews={reviews} />}
    </div>
  )
}

function CupGrid({ reviews }: { reviews: Cup[] }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gridAutoRows: 128, gridAutoFlow: "dense", gap: 3 }}>
      {reviews.map((r, i) => (
        <div key={r.id} style={{ gridRow: i % 9 === 0 ? "span 2" : undefined, gridColumn: i % 9 === 5 ? "span 2" : undefined }}>
          <CupTile review={r} />
        </div>
      ))}
    </div>
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
  if (places.length === 0) return <EmptyState title="no places yet" body="Cafés show up here once there are cups logged at them." />

  return (
    <section style={{ padding: "0 24px" }}>
      {places.map(({ place, scores }) => {
        const avg = scores.reduce((a, b) => a + b, 0) / scores.length
        const home = isHomePlace(place)
        const row = (
          <>
            <span className="t-title" style={{ fontSize: 22, flexGrow: 1 }}>{home ? "at home" : place.name}</span>
            <span style={{ fontSize: 12, color: "var(--c-mid)" }}>{scores.length} {scores.length === 1 ? "cup" : "cups"}</span>
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
      <SleepyBean size={120} />
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
