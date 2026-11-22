"use client"

import { track } from "@niche/analytics"
import { hasPendingInvite, type InviteResult } from "@niche/database"
import Link from "next/link"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { claimInvite } from "@/app/actions"
import { Avatar } from "@/components/ui/Primitives"

/**
 * Claims an invite link opened before signing in, once the person is in, then
 * says who they're now following — and refreshes so that friend's cups show up.
 */
export default function PendingInvite() {
  const router = useRouter()
  const [joined, setJoined] = useState<Extract<InviteResult, { status: "ok" }> | null>(null)

  useEffect(() => {
    if (!hasPendingInvite()) return
    let cancelled = false
    claimInvite()
      .then(result => {
        if (cancelled || result?.status !== "ok") return
        track("invite_accepted", { mutual: result.mutual, credited: result.credited, via: "signup" })
        setJoined(result)
        router.refresh()
      })
      .catch(() => {}) // the link is still remembered; it's tried again next time
    return () => { cancelled = true }
  }, [router])

  if (!joined) return null
  const name = joined.display_name?.split(" ")[0] || joined.username

  return (
    <div role="status" style={{
      margin: "12px 12px 0", padding: "14px 16px", display: "flex", alignItems: "center", gap: 12,
      background: "var(--c-paper)", borderTop: "1px solid var(--c-ink)", borderBottom: "1px solid var(--c-rule)",
    }}>
      <Avatar user={joined} size={40} />
      <span style={{ flexGrow: 1, display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
        <span className="t-label">from {name}&rsquo;s invite</span>
        <span className="t-title" style={{ fontSize: 19 }}>
          {joined.mutual ? <>you and <em>{name}</em> follow each other now.</> : <>you&rsquo;re following <em>{name}</em>.</>}
        </span>
        <Link href={`/profile/${joined.username}?tab=ranked`} className="t-meta" style={{ textDecoration: "underline", textUnderlineOffset: 3 }}>
          see {name}&rsquo;s ranked list
        </Link>
      </span>
      <button type="button" onClick={() => setJoined(null)} aria-label="Dismiss" className="icon-btn" style={{ alignSelf: "flex-start" }}>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  )
}
