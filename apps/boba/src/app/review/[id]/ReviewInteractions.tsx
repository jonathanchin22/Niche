"use client"

import { track } from "@niche/analytics"
import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { createClient } from "@niche/auth/client"
import { addReviewComment, cheerReview, deleteReview, getReviewComments, saveReview, uncheerReview, unsaveReview } from "@niche/database"
import SafetyMenu from "@/components/safety/SafetyMenu"
import { Avatar, BookmarkIcon, CheersIcon } from "@/components/ui/Primitives"
import { timeAgo, type CupComment } from "@/lib/boba"

interface Props {
  reviewId: string
  userId: string
  isOwn: boolean
  author: { id: string; username: string } | null
  shareTitle: string
  initialCheers: number
  initialCheered: boolean
  initialSaved: boolean
  initialComments: CupComment[]
}

export default function ReviewInteractions(props: Props) {
  const { reviewId, userId, isOwn } = props
  const [cheers, setCheers] = useState(props.initialCheers)
  const [cheered, setCheered] = useState(props.initialCheered)
  const [saved, setSaved] = useState(props.initialSaved)
  const [comments, setComments] = useState<CupComment[]>(props.initialComments)
  const [draft, setDraft] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [sending, startSending] = useTransition()
  const [deleting, startDeleting] = useTransition()
  const [copied, setCopied] = useState(false)
  const router = useRouter()

  // Optimistic toggles; roll back if the write fails.
  const toggleCheers = async () => {
    const next = !cheered
    setCheered(next); setCheers(c => c + (next ? 1 : -1)); setError(null)
    try {
      const supabase = createClient()
      if (next) await cheerReview(supabase, { review_id: reviewId, user_id: userId })
      if (next) track("cheer_sent")
      else await uncheerReview(supabase, { review_id: reviewId, user_id: userId })
    } catch {
      setCheered(!next); setCheers(c => c + (next ? -1 : 1)); setError("Couldn't save that — try again.")
    }
  }

  const toggleSaved = async () => {
    const next = !saved
    setSaved(next); setError(null)
    try {
      const supabase = createClient()
      if (next) await saveReview(supabase, { review_id: reviewId, user_id: userId })
      if (next) track("cup_saved")
      else await unsaveReview(supabase, { review_id: reviewId, user_id: userId })
    } catch {
      setSaved(!next); setError("Couldn't save that — try again.")
    }
  }

  const share = async () => {
    const url = window.location.href
    if (navigator.share) await navigator.share({ title: props.shareTitle, url }).catch(() => {})
    else {
      await navigator.clipboard?.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const remove = () => {
    if (!window.confirm("Delete this sip? This can't be undone.")) return
    startDeleting(async () => {
      try {
        await deleteReview(createClient(), { review_id: reviewId, user_id: userId })
        track("cup_deleted")
        router.replace("/profile")
        router.refresh()
      } catch {
        setError("Couldn't delete it — try again.")
      }
    })
  }

  const send = () => {
    const body = draft.trim()
    if (!body) return
    startSending(async () => {
      try {
        const supabase = createClient()
        await addReviewComment(supabase, { review_id: reviewId, user_id: userId, body })
        track("comment_sent")
        const fresh = await getReviewComments(supabase, { review_id: reviewId })
        setComments([...fresh].reverse() as CupComment[])
        setDraft("")
      } catch {
        setError("Couldn't post your comment — try again.")
      }
    })
  }

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: isOwn ? "1fr 52px" : "1fr 1fr 52px", gap: 10, padding: "24px 24px 0" }}>
        <button type="button" aria-pressed={cheered} onClick={toggleCheers} className={`btn ${cheered ? "btn-primary" : "btn-secondary"}`} style={{ padding: 0 }}>
          <CheersIcon /> cheers{cheers > 0 ? ` · ${cheers}` : ""}
        </button>
        {!isOwn && (
          <button type="button" aria-pressed={saved} onClick={toggleSaved} className={`btn ${saved ? "btn-primary" : "btn-secondary"}`} style={{ padding: 0 }}>
            <BookmarkIcon filled={saved} /> {saved ? "on your list" : "want to try"}
          </button>
        )}
        <button type="button" aria-label="Share" onClick={share} className="btn btn-secondary" style={{ padding: 0 }}>
          <svg width="16" height="18" viewBox="0 0 16 18" fill="none" aria-hidden="true">
            <path d="M8 1 V12M3.5 5.5 L8 1 L12.5 5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M2 10 V17 H14 V10" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
      {error && <p role="alert" className="t-meta" style={{ padding: "10px 24px 0" }}>{error}</p>}
      {copied && <p role="status" className="t-meta" style={{ padding: "10px 24px 0" }}>Link copied.</p>}

      <section style={{ padding: "32px 24px 140px" }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", paddingBottom: 12, borderBottom: "1px solid var(--c-rule)" }}>
          <h2 className="t-section">conversation</h2>
          <span className="t-label">{comments.length}</span>
        </div>
        {comments.length === 0 && <p className="t-meta" style={{ padding: "16px 0" }}>Be the first to say something.</p>}
        {comments.map(c => (
          <div key={c.id} style={{ display: "flex", gap: 12, padding: "16px 0", borderBottom: "1px solid var(--c-rule)" }}>
            <Avatar user={c.user} />
            <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
              <span style={{ fontSize: 13, fontWeight: 500 }}>
                {c.user?.username ? <Link href={`/profile/${c.user.username}`}>{c.user.username}</Link> : "someone"}
                <span style={{ fontWeight: 400, color: "var(--c-mid)" }}> · {timeAgo(c.created_at)}</span>
              </span>
              <span style={{ fontSize: 15, lineHeight: 1.45, overflowWrap: "anywhere" }}>{c.body}</span>
            </div>
          </div>
        ))}
        {!isOwn && props.author && (
          <div style={{ marginTop: 20 }}>
            <SafetyMenu viewerId={userId} target={props.author} reviewId={reviewId} trigger="links" noun="sip" />
          </div>
        )}
        {isOwn && (
          <button type="button" onClick={remove} disabled={deleting} className="t-label"
            style={{ display: "block", margin: "28px auto 0", minHeight: 44, padding: "0 12px", background: "none", border: "none", cursor: "pointer" }}>
            {deleting ? "deleting…" : "delete this sip"}
          </button>
        )}
      </section>

      <form
        onSubmit={e => { e.preventDefault(); send() }}
        style={{
          position: "fixed", left: "50%", bottom: 0, transform: "translateX(-50%)", width: "100%", maxWidth: 430,
          padding: "12px 16px max(30px, env(safe-area-inset-bottom))", background: "var(--c-bg)", borderTop: "1px solid var(--c-rule)",
          display: "flex", gap: 8, alignItems: "center",
        }}
      >
        <label htmlFor="comment" className="sr-only">Add a comment</label>
        <input id="comment" className="field" value={draft} maxLength={500} placeholder="say something nice…" onChange={e => setDraft(e.target.value)} />
        <button type="submit" aria-label="Send" disabled={sending || !draft.trim()} className="icon-btn" style={{ background: "var(--c-ink)", flexShrink: 0, opacity: sending || !draft.trim() ? 0.4 : 1 }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M8 14 V2M3 7 L8 2 L13 7" stroke="var(--c-bg)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </form>
    </>
  )
}
