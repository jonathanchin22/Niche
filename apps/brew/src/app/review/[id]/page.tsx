import Link from "next/link"
import { notFound } from "next/navigation"
import { createServerSupabaseClient } from "@niche/auth/server"
import { getReviewDetail } from "@niche/database"
import AppShell from "@/components/ui/AppShell"
import { DrinkDoodle } from "@/components/ui/Doodles"
import { Avatar, Score } from "@/components/ui/Primitives"
import { isHomePlace, placeLabel, timeAgo, type Cup, type CupComment } from "@/lib/brew"
import BackButton from "@/components/ui/BackButton"
import ReviewInteractions from "./ReviewInteractions"

export default async function ReviewPage({ params }: { params: { id: string } }) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const review = await getReviewDetail(supabase, { review_id: params.id, user_id: user.id }).catch(() => null)
  if (!review) notFound()
  const r = review as Cup & { comments: CupComment[]; saved: boolean }
  const photo = r.image_urls?.[0]
  const name = r.item_name ?? r.category ?? "a cup"

  return (
    <AppShell nav={false}>
      <div style={{ position: "relative" }}>
        {photo
          ? <img src={photo} alt={name} style={{ width: "100%", height: 480, objectFit: "cover", background: "var(--c-tint)" }} />
          : (
            <div style={{ height: 360, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--c-paper)", borderBottom: "1px solid var(--c-rule)" }}>
              <DrinkDoodle category={r.category} itemName={r.item_name} atHome={isHomePlace(r.place)} size={200} />
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
          <h1 className="t-display" style={{ fontSize: 54 }}>{name}</h1>
          <Score value={r.score} size={44} />
        </div>
        {r.place && !isHomePlace(r.place) ? (
          <Link href={`/place/${r.place.id}`} className="t-meta" style={{ fontSize: 14, display: "inline-flex", gap: 8, alignItems: "center" }}>
            {placeLabel(r.place)} <span aria-hidden="true">›</span>
          </Link>
        ) : (
          <span className="t-meta" style={{ fontSize: 14 }}>brewed at home</span>
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
        shareTitle={`${name} · ${placeLabel(r.place) || "brew."}`}
        initialCheers={r.upvotes_count ?? 0}
        initialCheered={r.user_vote === 1}
        initialSaved={r.saved}
        initialComments={r.comments}
      />
    </AppShell>
  )
}
