import type { Metadata } from "next"
import Link from "next/link"
import { cache, type ReactNode } from "react"
import { getServerSession } from "@niche/auth/server"
import { getInvite, getRankLadder, isFollowing, type Inviter } from "@niche/database"
import type { Review } from "@niche/shared-types"
import { SleepyBean, SteamingCup, Underline } from "@/components/ui/Doodles"
import { Avatar } from "@/components/ui/Primitives"
import { APP_ID, formatScore, placeLabel, type Cup } from "@/lib/brew"
import InviteActions from "./InviteActions"

const loadInvite = cache(async (code: string): Promise<Inviter | null> => {
  const { supabase } = await getServerSession()
  return getInvite(supabase, code).catch(() => null)
})

const firstName = (p: Inviter) => p.display_name?.split(" ")[0] || p.username

export async function generateMetadata({ params }: { params: { code: string } }): Promise<Metadata> {
  const inviter = await loadInvite(params.code)
  if (!inviter) return { title: "Niche Brew" }
  const title = `${firstName(inviter)} invited you to brew`
  const description = `See ${firstName(inviter)}'s ranked cups, and keep your own coffee notes next to theirs.`
  return { title, description, openGraph: { title, description }, robots: { index: false } }
}

/** A friend's invite link: who it's from, their best cups, and one button to join them. */
export default async function InvitePage({ params }: { params: { code: string } }) {
  const inviter = await loadInvite(params.code)
  const { supabase, user } = await getServerSession()

  if (!inviter) {
    return (
      <Frame>
        <SleepyBean size={120} />
        <h1 className="t-display" style={{ fontSize: 40 }}>this invite has gone cold.</h1>
        <p className="t-meta" style={{ maxWidth: 300, lineHeight: 1.5 }}>The link may be mistyped. Ask your friend to send it again — or just come in.</p>
        <Link href="/" className="btn btn-primary" style={{ marginTop: 8 }}>open brew</Link>
      </Frame>
    )
  }

  const name = firstName(inviter)

  if (user?.id === inviter.id) {
    return (
      <Frame>
        <SteamingCup size={110} />
        <h1 className="t-display" style={{ fontSize: 40 }}>this is your invite.</h1>
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
    <div style={{ minHeight: "100svh", maxWidth: 430, margin: "0 auto", display: "flex", flexDirection: "column", paddingBottom: 40 }}>
      <header style={{ height: 56, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 20px 0" }}>
        <span style={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontSize: 26, letterSpacing: "-0.01em" }}>brew.</span>
        <span className="t-label" style={{ letterSpacing: "0.16em" }}>an invitation</span>
      </header>

      <section style={{ display: "flex", flexDirection: "column", gap: 14, padding: "36px 24px 0" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Avatar user={inviter} size={44} />
          <span className="t-label" style={{ letterSpacing: "0.16em" }}>from @{inviter.username}</span>
        </span>
        <h1 className="t-display" style={{ fontSize: 46, lineHeight: 0.98 }}>
          {name} saved you<br />a seat at the bar.
        </h1>
        <span style={{ marginTop: -10 }}><Underline /></span>
        <p style={{ fontSize: 15, lineHeight: 1.55, color: "var(--c-mid)" }}>
          brew is a quiet place to keep every cup you drink, ranked against each other — and to see what your friends are drinking.
        </p>
      </section>

      {top.length > 0 && (
        <section aria-labelledby="their-best" style={{ padding: "30px 24px 0" }}>
          <h2 id="their-best" className="t-section" style={{ paddingBottom: 6 }}>{name}&rsquo;s best cups</h2>
          <ol style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {top.map((cup, i) => (
              <li key={cup.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 0", borderBottom: "1px solid var(--c-rule)" }}>
                <span className="t-score" aria-hidden="true" style={{ fontSize: 34, width: 22, color: "var(--c-subtle)" }}>{i + 1}</span>
                <span style={{ flexGrow: 1, display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
                  <span className="t-title" style={{ fontSize: 20 }}>{cup.item_name ?? cup.category ?? "a cup"}</span>
                  <span className="t-meta" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{placeLabel(cup.place)}</span>
                </span>
                <span className="t-score" style={{ fontSize: 30 }} aria-label={`scored ${formatScore(cup.score)}`}>{formatScore(cup.score)}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      <div style={{ padding: "30px 24px 0" }}>
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
