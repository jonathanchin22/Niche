"use client"

import { track } from "@niche/analytics"
import type { Inviter } from "@niche/database"
import Link from "next/link"
import { useEffect, useState } from "react"
import { Avatar } from "@/components/ui/Primitives"

/**
 * Your invite link, ready to send. Friends who join from it follow you and
 * are followed back, so you both start with someone in your feed.
 */
export default function InviteCard({ code, joined }: { code: string | null; joined: Inviter[] }) {
  const [origin, setOrigin] = useState("")
  const [canShare, setCanShare] = useState(false)
  const [status, setStatus] = useState("")

  useEffect(() => {
    setOrigin(window.location.origin)
    setCanShare(typeof navigator.share === "function")
  }, [])

  if (!code) return null
  const link = `${origin}/i/${code}`

  async function copy() {
    try {
      await navigator.clipboard.writeText(link)
      setStatus("Link copied.")
      track("invite_sent", { method: "copy" })
    } catch {
      setStatus("Couldn’t copy — press and hold the link to copy it.")
    }
  }

  async function share() {
    try {
      await navigator.share({ title: "brew", text: "Come keep your coffee notes with me on brew.", url: link })
      track("invite_sent", { method: "share" })
    } catch (err) {
      // Closing the share sheet isn't a failure; anything else falls back to copying.
      if (err instanceof DOMException && err.name === "AbortError") return
      await copy()
    }
  }

  return (
    <section aria-labelledby="invite-heading" style={{ margin: "26px 24px 0", padding: "18px 0", borderTop: "1px solid var(--c-ink)", borderBottom: "1px solid var(--c-rule)", display: "flex", flexDirection: "column", gap: 12 }}>
      <span className="t-label">bring a friend</span>
      <h2 id="invite-heading" className="t-title" style={{ fontSize: 24 }}>coffee&rsquo;s better compared.</h2>
      <p className="t-meta" style={{ fontSize: 14, lineHeight: 1.5 }}>
        Anyone who joins from your link follows you, and you follow them back.
      </p>

      <p
        aria-label="Your invite link"
        style={{ fontFamily: "var(--font-mono)", fontSize: 13, padding: "12px 14px", background: "var(--c-paper)", border: "1px solid var(--c-rule)", wordBreak: "break-all", userSelect: "all" }}
      >
        {origin ? link : `…/i/${code}`}
      </p>

      <div style={{ display: "flex", gap: 10 }}>
        {canShare && (
          <button type="button" className="btn btn-primary btn-sm" style={{ flex: 1 }} onClick={share} disabled={!origin}>send invite</button>
        )}
        <button type="button" className={`btn btn-sm ${canShare ? "btn-secondary" : "btn-primary"}`} style={{ flex: 1 }} onClick={copy} disabled={!origin}>copy link</button>
      </div>
      <p role="status" aria-live="polite" className="t-meta" style={{ minHeight: 0 }}>{status}</p>

      {joined.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ display: "flex" }}>
            {joined.slice(0, 5).map((p, i) => (
              <Link key={p.id} href={`/profile/${p.username}`} aria-label={p.username} style={{ display: "inline-flex", marginLeft: i === 0 ? 0 : -8, borderRadius: 16, boxShadow: "0 0 0 2px var(--c-bg)" }}>
                <Avatar user={p} size={30} />
              </Link>
            ))}
          </span>
          <span className="t-meta">
            {joined.length === 1 ? `${joined[0]!.username} joined from your link` : `${joined.length} friends joined from your link`}
          </span>
        </div>
      )}
    </section>
  )
}
