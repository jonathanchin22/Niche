"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@niche/auth/client"
import { blockUser, reportContent, type ReportReason } from "@niche/database"

const REASONS: { key: ReportReason; label: string }[] = [
  { key: "spam", label: "spam or advertising" },
  { key: "harassment", label: "harassment or hate" },
  { key: "inappropriate", label: "inappropriate photo or words" },
  { key: "fake", label: "fake or paid review" },
  { key: "other", label: "something else" },
]

/**
 * Report and block, from a profile ("…" button) or a cup (text links).
 * App stores require both for user-generated content.
 */
export default function SafetyMenu({ viewerId, target, reviewId, trigger = "icon", noun = "cup" }: {
  viewerId: string
  target: { id: string; username: string }
  reviewId?: string
  trigger?: "icon" | "links"
  noun?: string
}) {
  const router = useRouter()
  const [sheet, setSheet] = useState<null | "menu" | "report" | "block" | "done">(null)
  const [message, setMessage] = useState("")
  const [busy, start] = useTransition()

  useEffect(() => {
    if (!sheet) return
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setSheet(null) }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [sheet])

  const report = (reason: ReportReason) => start(async () => {
    try {
      await reportContent(createClient(), {
        reporter_id: viewerId, reason,
        review_id: reviewId ?? null,
        reported_user_id: reviewId ? null : target.id,
      })
      setMessage("Thanks for telling us. We’ll take a look.")
    } catch {
      setMessage("Couldn’t send that report — try again.")
    }
    setSheet("done")
  })

  const block = () => start(async () => {
    try {
      await blockUser(createClient(), { blocker_id: viewerId, blocked_id: target.id })
      setSheet(null)
      if (reviewId) router.replace("/")
      router.refresh()
    } catch {
      setMessage(`Couldn’t block @${target.username} — try again.`)
      setSheet("done")
    }
  })

  const option = { width: "100%", minHeight: 52, padding: "0 20px", textAlign: "left", fontSize: 16, background: "none", border: "none", borderBottom: "1px solid var(--c-rule)", cursor: "pointer" } as const

  return (
    <>
      {trigger === "icon" ? (
        <button type="button" aria-label={`More options for @${target.username}`} className="icon-btn" onClick={() => setSheet("menu")}>
          <svg width="18" height="4" viewBox="0 0 18 4" fill="currentColor" aria-hidden="true"><circle cx="2" cy="2" r="1.6" /><circle cx="9" cy="2" r="1.6" /><circle cx="16" cy="2" r="1.6" /></svg>
        </button>
      ) : (
        <span style={{ display: "flex", justifyContent: "center", gap: 18 }}>
          <button type="button" className="t-label" onClick={() => setSheet("report")} style={{ minHeight: 44, background: "none", border: "none", cursor: "pointer" }}>report this {noun}</button>
          <button type="button" className="t-label" onClick={() => setSheet("block")} style={{ minHeight: 44, background: "none", border: "none", cursor: "pointer" }}>block @{target.username}</button>
        </span>
      )}

      {sheet && (
        <div role="presentation" onClick={() => setSheet(null)} style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(28,20,16,0.35)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          <div role="dialog" aria-modal="true" aria-label="Options" onClick={e => e.stopPropagation()} style={{
            width: "100%", maxWidth: 430, background: "var(--c-bg)", borderRadius: "18px 18px 0 0",
            paddingBottom: "max(24px, env(safe-area-inset-bottom))", overflow: "hidden",
          }}>
            {sheet === "menu" && (
              <>
                <button type="button" style={option} onClick={() => setSheet("report")}>report @{target.username}</button>
                <button type="button" style={option} onClick={() => setSheet("block")}>block @{target.username}</button>
                <button type="button" style={{ ...option, borderBottom: "none", color: "var(--c-mid)" }} onClick={() => setSheet(null)}>cancel</button>
              </>
            )}
            {sheet === "report" && (
              <>
                <p className="t-label" style={{ padding: "18px 20px 8px" }}>why are you reporting this?</p>
                {REASONS.map(r => (
                  <button key={r.key} type="button" disabled={busy} style={option} onClick={() => report(r.key)}>{r.label}</button>
                ))}
                <button type="button" style={{ ...option, borderBottom: "none", color: "var(--c-mid)" }} onClick={() => setSheet(null)}>cancel</button>
              </>
            )}
            {sheet === "block" && (
              <div style={{ padding: "22px 20px 4px", display: "flex", flexDirection: "column", gap: 12 }}>
                <p style={{ fontSize: 17, fontWeight: 500 }}>Block @{target.username}?</p>
                <p className="t-meta" style={{ lineHeight: 1.5 }}>You won’t see each other’s cups or comments, and they won’t be able to follow you. They aren’t told. You can unblock in settings.</p>
                <button type="button" className="btn btn-primary" disabled={busy} onClick={block}>{busy ? "blocking…" : "block"}</button>
                <button type="button" className="btn btn-secondary" onClick={() => setSheet(null)}>cancel</button>
              </div>
            )}
            {sheet === "done" && (
              <div style={{ padding: "22px 20px 4px", display: "flex", flexDirection: "column", gap: 12 }}>
                <p role="status" style={{ fontSize: 16 }}>{message}</p>
                <button type="button" className="btn btn-secondary" onClick={() => setSheet(null)}>done</button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
