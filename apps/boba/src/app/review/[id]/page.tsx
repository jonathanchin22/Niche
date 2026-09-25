import Link from "next/link"
import { notFound } from "next/navigation"
import { getServerSession } from "@niche/auth/server"
import { getPersonalRankPosition, getReviewDetail } from "@niche/database"
import AppShell from "@/components/ui/AppShell"
import { DrinkDoodle } from "@/components/ui/Doodles"
import { Avatar, Score } from "@/components/ui/Primitives"
import { APP_ID, isHomePlace, placeLabel, tasteChips, timeAgo, type Cup, type CupComment } from "@/lib/boba"
import BackButton from "@/components/ui/BackButton"
import ReviewInteractions from "./ReviewInteractions"

export default async function ReviewPage({ params }: { params: { id: string } }) {
  const { supabase, user } = await getServerSession()
  if (!user) return null

  const review = await getReviewDetail(supabase, { review_id: params.id, user_id: user.id }).catch(() => null)
  if (!review) notFound()
  const r = review as Cup & { comments: CupComment[]; saved: boolean }
  const photo = r.image_urls?.[0]
  const name = r.item_name ?? r.category ?? "a boba"
  const isOwn = r.user_id === user.id
  const rank = await getPersonalRankPosition(supabase, { review_id: r.id, user_id: r.user_id, app_id: APP_ID }).catch(() => null)
  const rankHref = isOwn ? "/profile?tab=ranked" : `/profile/${r.user?.username}?tab=ranked`
  const chips = tasteChips(r)

  return (
    <AppShell nav={false}>
      <div style={{ position: "relative" }}>
        {photo
          ? <img src={photo} alt={name} style={{ width: "100%", height: 500, objectFit: "cover", background: "var(--c-tint)", borderRadius: "0 0 28px 28px" }} />
          : (
            <div style={{ height: 360, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--c-paper)", borderBottom: "1px solid var(--c-rule)", borderRadius: "0 0 28px 28px" }}>
              <DrinkDoodle category={r.category} itemName={r.item_name} size={200} />
            </div>
          )}
        <div style={{ position: "absolute", top: 52, left: 16 }}><BackButton /></div>
      </div>

      <section style={{ display: "flex", flexDirection: "column", gap: 16, padding: "24px 24px 0" }}>
        <Link href={r.user?.username ? `/profile/${r.user.username}` : "#"} style={{ display: "flex", alignItems: "center", gap: 10, alignSelf: "flex-start" }}>
          <Avatar user={r.user} />
          <span style={{ fontSize: 14, fontWeight: 500 }}>{r.user?.username}</span>
          <span className="t-label">· {timeAgo(r.created_at)}</span>
        </Link>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12 }}>
          <h1 className="t-display" style={{ fontSize: 50 }}>{name}</h1>
          <Score value={r.score} size={44} />
        </div>
        {r.place && !isHomePlace(r.place) ? (
          <Link href={`/place/${r.place.id}`} className="t-meta" style={{ fontSize: 14, display: "inline-flex", gap: 8, alignItems: "center" }}>
            {placeLabel(r.place)} <span aria-hidden="true">›</span>
          </Link>
        ) : (
          <span className="t-meta" style={{ fontSize: 14 }}>made at home</span>
        )}
        {chips.length > 0 && (
          <div aria-label="Their order" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {chips.map(c => <span key={c} className="taste">{c}</span>)}
          </div>
        )}
        {rank && rank.total > 1 && (
          <Link href={rankHref} className="t-label" style={{ alignSelf: "flex-start", display: "inline-flex", alignItems: "center", gap: 6, color: "var(--c-jade)" }}>
            <span className="t-score" style={{ fontSize: 18, letterSpacing: 0, textTransform: "none" }}>#{rank.position}</span>
            {isOwn ? `of your ${rank.total} sips` : `of ${r.user?.username}’s ${rank.total} sips`} ›
          </Link>
        )}
        {r.note && <p className="t-hand" style={{ fontSize: 25, lineHeight: 1.2, marginTop: 6 }}>“{r.note}”</p>}
        {r.tags.length > 0 && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {r.tags.map((t: string) => <span key={t} className="tag">{t}</span>)}
          </div>
        )}
      </section>

      <ReviewInteractions
        reviewId={r.id}
        userId={user.id}
        isOwn={r.user_id === user.id}
        author={r.user?.username ? { id: r.user_id, username: r.user.username } : null}
        shareTitle={`${name} · ${placeLabel(r.place) || "boba!"}`}
        initialCheers={r.upvotes_count ?? 0}
        initialCheered={r.user_vote === 1}
        initialSaved={r.saved}
        initialComments={r.comments}
      />
    </AppShell>
  )
}
