import { createServerSupabaseClient } from "@niche/auth/server"
import { getUserReviews, getProfile, getMyFeed } from "@niche/database"
import AppShell from "@/components/ui/AppShell"
import { MonoLabel, Stars, CupSteamSketch, SectionDivider } from "@/components/ui/Primitives"
import { formatDistanceToNow } from "date-fns"
import type { Review } from "@niche/shared-types"
import Link from "next/link"
import MyFeedSection from "@/components/MyFeedSection"

const APP_ID = "brew" as const

export default async function HomePage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const [feedResult, profile] = await Promise.all([
    getUserReviews(supabase, { user_id: user.id, app_id: APP_ID, limit: 5 }),
    getProfile(supabase, user.id),
  ])

  const recentReviews = feedResult.data.map(item => item.review).filter(Boolean) as Review[]

  // Count unique cafes
  const cafesVisited = new Set(recentReviews.map(r => r.place_id)).size

  return (
    <AppShell>
      <div>
        {/* Hero */}
        <div style={{ padding: "52px 28px 0", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
          <div style={{ flex: 1 }}>
            <MonoLabel style={{ marginBottom: 12 }}>niche / brew</MonoLabel>
            <h1 style={{ fontFamily: "var(--font-display)", fontSize: 52, color: "var(--c-ink)", margin: 0, fontWeight: 400, lineHeight: 0.95, letterSpacing: "-0.02em" }}>
              your<br />brew<br />world
            </h1>
            <p style={{ fontFamily: "var(--font-hand)", fontSize: 17, color: "var(--c-subtle)", margin: "14px 0 0", lineHeight: 1.4 }}>
              every cup,<br />remembered
            </p>
          </div>
          <div style={{ flexShrink: 0, paddingTop: 4 }}>
            <CupSteamSketch size={80} />
          </div>
        </div>

        <SectionDivider label="today" />

        {/* Recently logged */}
        <div style={{ padding: "20px 28px 0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 16 }}>
            <p style={{ fontFamily: "var(--font-display)", fontSize: 20, color: "var(--c-ink)", margin: 0, fontWeight: 400, fontStyle: "italic" }}>
              recently logged
            </p>
            <Link href="/my-reviews" style={{ textDecoration: "none" }}>
              <MonoLabel>see all →</MonoLabel>
            </Link>
          </div>

          {recentReviews.length === 0 ? (
            <div style={{ borderTop: "1px solid var(--c-rule)", padding: "24px 0", textAlign: "center" }}>
              <p style={{ fontFamily: "var(--font-hand)", fontSize: 16, color: "var(--c-subtle)" }}>
                Nothing logged yet — tap + to start.
              </p>
            </div>
          ) : (
            recentReviews.map((review, i) => (
              <div key={review.id} style={{
                display: "flex", gap: 16, alignItems: "center",
                borderTop: "1px solid var(--c-rule)",
                paddingTop: 16, paddingBottom: i < recentReviews.length - 1 ? 16 : 0,
              }}>
                <div style={{
                  width: 64, height: 64, borderRadius: 4, flexShrink: 0,
                  overflow: "hidden", background: "var(--c-tint)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  {review.image_urls?.[0] ? (
                    <img src={review.image_urls[0]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    <span style={{ fontSize: 20 }}>☕</span>
                  )}
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontFamily: "var(--font-display)", fontSize: 18, margin: "0 0 2px", color: "var(--c-ink)", fontWeight: 400 }}>
                    {review.item_name ?? review.category}
                  </p>
                  <p style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--c-subtle)", margin: "0 0 8px", letterSpacing: "0.05em", textTransform: "uppercase" }}>
                    {review.place?.name ?? ""} · {formatDistanceToNow(new Date(review.created_at))} ago
                  </p>
                  <Stars value={Math.round((review.score / 10) * 5)} />
                </div>
              </div>
            ))
          )}
        </div>

        <SectionDivider label="quick access" />

        {/* Quick nav tiles */}
        <div style={{ display: "flex", gap: 10, padding: "20px 28px 0", overflowX: "auto" }}>
          {([
            ["/explore",    "◎", "cafes"],
            ["/log",        "✦", "new drink"],
            ["/friends",    "♡", "their picks"],
            ["/profile",    "◯", "your stats"],
          ] as [string, string, string][]).map(([href, icon, sub]) => (
            <Link key={href} href={href} style={{ textDecoration: "none" }}>
              <div style={{
                flexShrink: 0, background: "var(--c-paper)", border: "1px solid var(--c-rule)",
                borderRadius: 4, padding: "16px 18px", textAlign: "center", minWidth: 80,
              }}>
                <div style={{ fontSize: 20, color: "var(--c-accent)", marginBottom: 6 }}>{icon}</div>
                <MonoLabel style={{ color: "var(--c-mid)" }}>{sub}</MonoLabel>
              </div>
            </Link>
          ))}
        </div>

        {/* Stats pull-quote */}
        <div style={{ margin: "32px 28px 0", padding: "24px", background: "var(--c-accent-bg)", borderLeft: "3px solid var(--c-accent)" }}>
          <p style={{ fontFamily: "var(--font-display)", fontSize: 28, color: "var(--c-accent)", margin: 0, fontWeight: 400, fontStyle: "italic", lineHeight: 1.2 }}>
            &ldquo;{recentReviews.length} drinks logged.<br />{cafesVisited} cafes visited.&rdquo;
          </p>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--c-subtle)", margin: "12px 0 0", letterSpacing: "0.1em", textTransform: "uppercase" }}>
            your {new Date().getFullYear()} so far
          </p>
        </div>

        <SectionDivider label="feed" />
        <MyFeedSection userId={user.id} />
      </div>
    </AppShell>
  )
}
