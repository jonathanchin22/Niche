import Link from "next/link"
import { getServerSession } from "@niche/auth/server"
import { getActivity, getSuggestedPeople, type ActivityItem } from "@niche/database"
import AppShell from "@/components/ui/AppShell"
import { Avatar, PageTitle, SectionHeading } from "@/components/ui/Primitives"
import FollowButton from "@/components/profile/FollowButton"
import { APP_ID, isHomePlace, timeAgo } from "@/lib/boba"
import PeopleSearch from "./PeopleSearch"

function describe(item: ActivityItem) {
  const drink = item.review?.item_name ?? item.review?.category ?? "drink"
  switch (item.kind) {
    case "cheer": return <>said cheers to your <em className="t-title" style={{ fontSize: 17, fontStyle: "italic" }}>{drink}</em></>
    case "save": return <>saved your <em className="t-title" style={{ fontSize: 17, fontStyle: "italic" }}>{drink}</em> to try</>
    case "comment": return <>commented on your <em className="t-title" style={{ fontSize: 17, fontStyle: "italic" }}>{drink}</em></>
    case "follow": return <>started following you</>
    case "log": {
      const where = item.review?.place && !isHomePlace(item.review.place) ? ` at ${item.review.place.name}` : " at home"
      return <>logged <em className="t-title" style={{ fontSize: 17, fontStyle: "italic" }}>{drink}</em>{where}</>
    }
  }
}

export default async function FriendsPage() {
  const { supabase, user } = await getServerSession()
  if (!user) return null

  const [activity, suggestions] = await Promise.all([
    getActivity(supabase, { user_id: user.id, app_id: APP_ID }).catch(() => []),
    getSuggestedPeople(supabase, { user_id: user.id, app_id: APP_ID }).catch(() => []),
  ])

  return (
    <AppShell>
      <PageTitle>friends</PageTitle>
      <PeopleSearch viewerId={user.id} />

      <SectionHeading>lately</SectionHeading>
      <section style={{ padding: "0 24px" }}>
        {activity.length === 0 && (
          <p className="t-meta" style={{ fontSize: 14, lineHeight: 1.5 }}>Nothing yet. Follow a few people and their drinks — and their cheers on yours — show up here.</p>
        )}
        {activity.map(item => {
          const href = item.kind === "follow" || !item.review
            ? (item.actor?.username ? `/profile/${item.actor.username}` : "/friends")
            : `/review/${item.review.id}`
          const photo = item.review?.image_urls?.[0]
          return (
            <Link key={item.id} href={href} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 0", borderBottom: "1px solid var(--c-rule)" }}>
              <Avatar user={item.actor} size={36} />
              <span style={{ flexGrow: 1, display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
                <span style={{ fontSize: 15, lineHeight: 1.35 }}>
                  <span style={{ fontWeight: 500 }}>{item.actor?.username ?? "someone"}</span> {describe(item)}
                </span>
                <span style={{ fontSize: 12, color: "var(--c-mid)" }}>{timeAgo(item.created_at)}</span>
              </span>
              {photo && <img src={photo} alt="" loading="lazy" className="photo" style={{ width: 52, height: 52, flexShrink: 0 }} />}
            </Link>
          )
        })}
      </section>

      {suggestions.length > 0 && (
        <>
          <SectionHeading aside={<span className="t-label">one tap to follow</span>}>people you might know</SectionHeading>
          <section style={{ padding: "0 24px" }}>
            {suggestions.map(p => (
              <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderBottom: "1px solid var(--c-rule)" }}>
                <Link href={`/profile/${p.username}`} style={{ display: "flex", alignItems: "center", gap: 12, flexGrow: 1, minWidth: 0 }}>
                  <Avatar user={p} size={36} />
                  <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                    <span style={{ fontSize: 15, fontWeight: 500 }}>{p.username}</span>
                    <span style={{ fontSize: 12, color: "var(--c-mid)" }}>{p.reason}</span>
                  </span>
                </Link>
                <FollowButton viewerId={user.id} targetId={p.id} initialFollowing={false} size="sm" />
              </div>
            ))}
          </section>
        </>
      )}
    </AppShell>
  )
}
