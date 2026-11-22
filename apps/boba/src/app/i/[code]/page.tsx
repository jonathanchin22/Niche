import type { Metadata } from "next"
import Link from "next/link"
import { cache, type ReactNode } from "react"
import { getServerSession } from "@niche/auth/server"
import { getInvite, getRankLadder, isFollowing, type Inviter } from "@niche/database"
import type { Review } from "@niche/shared-types"
import { BobaCup, SleepyPearl } from "@/components/ui/Doodles"
import { Avatar } from "@/components/ui/Primitives"
import { Wordmark } from "@/components/home/Cover"
import { APP_ID, formatScore, placeLabel, type Cup } from "@/lib/boba"
import InviteActions from "./InviteActions"

const loadInvite = cache(async (code: string): Promise<Inviter | null> => {
  const { supabase } = await getServerSession()
  return getInvite(supabase, code).catch(() => null)
})

const firstName = (p: Inviter) => p.display_name?.split(" ")[0] || p.username

export async function generateMetadata({ params }: { params: { code: string } }): Promise<Metadata> {
  const inviter = await loadInvite(params.code)
  if (!inviter) return { title: "boba!" }
  const title = `${firstName(inviter)} invited you to boba!`
  const description = `See ${firstName(inviter)}'s top sips, and start ranking your own bubble tea.`
  return { title, description, openGraph: { title, description, type: "website" }, robots: { index: false } }
}

/** A friend's invite link: who it's from, their top sips, and one button to join them. */
export default async function InvitePage({ params }: { params: { code: string } }) {
  const inviter = await loadInvite(params.code)
  const { supabase, user } = await getServerSession()

  if (!inviter) {
    return (
      <Frame>
        <SleepyPearl size={120} />
        <h1 className="t-display" style={{ fontSize: 38 }}>this invite fizzled out.</h1>
        <p className="t-meta" style={{ maxWidth: 300, lineHeight: 1.5 }}>The link may be mistyped. Ask your friend to send it again — or come on in anyway.</p>
        <Link href="/" className="btn btn-primary" style={{ marginTop: 8 }}>open boba!</Link>
      </Frame>
    )
  }

  const name = firstName(inviter)

  if (user?.id === inviter.id) {
    return (
      <Frame>
        <BobaCup size={110} />
        <h1 className="t-display" style={{ fontSize: 38 }}>this is your invite!</h1>
        <p className="t-meta" style={{ maxWidth: 300, lineHeight: 1.5 }}>Send it to a friend. When they join from it, you&rsquo;ll follow each other.</p>
        <Link href="/friends" className="btn btn-primary" style={{ marginTop: 8 }}>back to friends</Link>
      </Frame>
    )
  }

  const [ladder, member, following] = await Promise.all([
    getRankLadder(supabase, { user_id: inviter.id, app_id: APP_ID }).catch(() => [] as Review[]),
    user
      ? supabase.from("app_memberships").select("user_id").eq("user_id", user.id).eq("app_id", APP_ID).maybeSingle()
          .then(({ data }) => !!data, () => true)
      : Promise.resolve(false),
    user ? isFollowing(supabase, { follower_id: user.id, following_id: inviter.id }).catch(() => false) : Promise.resolve(false),
  ])
  const top = (ladder as Cup[]).slice(0, 3)
  const mode = !user ? "signed-out" : !member ? "join" : following ? "following" : "follow"

  return (
    <div style={{ minHeight: "100svh", maxWidth: 430, margin: "0 auto", display: "flex", flexDirection: "column", alignItems: "center", gap: 14, padding: "48px 24px 40px", textAlign: "center" }}>
      <BobaCup size={110} animated />
      <Wordmark size={52} />

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6 }}>
        <Avatar user={inviter} size={36} />
        <span className="t-hand" style={{ fontSize: 24 }}>{name} wants you here</span>
      </div>
      <h1 className="t-display" style={{ fontSize: 36, lineHeight: 1.02 }}>rank every boba<br />you try, together.</h1>
      <p className="t-meta" style={{ fontSize: 14, lineHeight: 1.55, maxWidth: 320 }}>
        Log a drink in seconds, watch it slot into your own ranked list, and see what {name} is sipping.
      </p>

      {top.length > 0 && (
        <section aria-labelledby="their-top" style={{ width: "100%", marginTop: 10, textAlign: "left" }}>
          <h2 id="their-top" className="t-label" style={{ paddingBottom: 10 }}>{name}&rsquo;s top {top.length === 1 ? "sip" : `${top.length}`}</h2>
          <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
            {top.map((cup, i) => {
              const photo = cup.image_urls?.[0]
              return (
                <li key={cup.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: 10, background: "var(--c-paper)", border: "1px solid var(--c-rule)", borderRadius: 18 }}>
                  <span style={{ position: "relative", width: 52, height: 52, flexShrink: 0 }}>
                    {photo
                      ? <img src={photo} alt="" loading="lazy" className="photo" style={{ borderRadius: 14 }} />
                      : <span aria-hidden="true" style={{ display: "flex", width: "100%", height: "100%", borderRadius: 14, background: "var(--c-tint)" }} />}
                    <span aria-hidden="true" style={{
                      position: "absolute", top: -6, left: -6, width: 22, height: 22, borderRadius: 11,
                      background: "var(--c-jade)", color: "#fff", fontSize: 12, fontWeight: 600,
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>{i + 1}</span>
                  </span>
                  <span style={{ flexGrow: 1, display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                    <span className="t-title" style={{ fontSize: 18 }}>
                      <span className="sr-only">{i + 1}. </span>{cup.item_name ?? cup.category ?? "a drink"}
                    </span>
                    <span className="t-meta" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{placeLabel(cup.place)}</span>
                  </span>
                  <span className="t-score" style={{ fontSize: 28, color: "var(--c-jade)" }} aria-label={`scored ${formatScore(cup.score)}`}>{formatScore(cup.score)}</span>
                </li>
              )
            })}
          </ol>
        </section>
      )}

      <div style={{ width: "100%", marginTop: 12 }}>
        <InviteActions code={params.code} name={name} username={inviter.username} mode={mode} />
      </div>
    </div>
  )
}

function Frame({ children }: { children: ReactNode }) {
  return (
    <main style={{
      minHeight: "100svh", maxWidth: 430, margin: "0 auto", padding: "0 32px",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, textAlign: "center",
    }}>
      {children}
    </main>
  )
}
