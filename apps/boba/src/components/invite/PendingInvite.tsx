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
 * says who they're now following — and refreshes so that friend's sips show up.
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
      margin: "12px 12px 0", padding: "14px 14px 14px 16px", display: "flex", alignItems: "center", gap: 12,
      background: "var(--c-paper)", border: "1px solid var(--c-rule)", borderRadius: 20,
    }}>
      <Avatar user={joined} size={44} />
      <span style={{ flexGrow: 1, display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
        <span className="t-hand" style={{ fontSize: 20, color: "var(--c-jade)" }}>you made it!</span>
        <span style={{ fontSize: 15, fontWeight: 500, lineHeight: 1.35 }}>
          {joined.mutual ? `you and ${name} follow each other now` : `you're following ${name}`}
        </span>
        <Link href={`/profile/${joined.username}?tab=ranked`} style={{ fontSize: 13, color: "var(--c-jade)", fontWeight: 500 }}>
          see {name}&rsquo;s ranked list →
        </Link>
      </span>
      <button type="button" onClick={() => setJoined(null)} aria-label="Dismiss" className="icon-btn" style={{ alignSelf: "flex-start", background: "transparent" }}>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  )
}
