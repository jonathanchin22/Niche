"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { createClient } from "@niche/auth/client"
import { deleteMyAccount, unblockUser } from "@niche/database"
import { Avatar, SectionHeading } from "@/components/ui/Primitives"

type Person = { id: string; username: string; display_name: string; avatar_url: string | null }

const row = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, minHeight: 56, borderBottom: "1px solid var(--c-rule)" } as const

export default function SettingsClient({ userId, email, blocked: initialBlocked, editProfileHref }: {
  userId: string
  email: string | null
  blocked: Person[]
  editProfileHref?: string
}) {
  const router = useRouter()
  const [blocked, setBlocked] = useState(initialBlocked)
  const [confirmText, setConfirmText] = useState("")
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, startBusy] = useTransition()

  const unblock = (person: Person) => {
    setBlocked(list => list.filter(p => p.id !== person.id))
    unblockUser(createClient(), { blocker_id: userId, blocked_id: person.id }).catch(() => {
      setBlocked(list => [person, ...list])
      setError(`Couldn't unblock @${person.username} — try again.`)
    })
  }

  const signOut = () => startBusy(async () => {
    await createClient().auth.signOut()
    router.replace("/auth/login")
    router.refresh()
  })

  const deleteAccount = () => startBusy(async () => {
    setError(null)
    try {
      const supabase = createClient()
      // Photos from every niche app live under <app>/<user id>/.
      await deleteMyAccount(supabase, { user_id: userId, apps: ["brew", "boba"] })
      await supabase.auth.signOut().catch(() => {})
      router.replace("/auth/login")
      router.refresh()
    } catch {
      setError("Couldn't delete your account — try again, or email us and we'll do it.")
    }
  })

  return (
    <div style={{ paddingBottom: 60 }}>
      <SectionHeading>account</SectionHeading>
      <section style={{ padding: "0 24px" }}>
        {email && (
          <div style={row}>
            <span style={{ fontSize: 15 }}>email</span>
            <span className="t-meta" style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{email}</span>
          </div>
        )}
        {editProfileHref && (
          <Link href={editProfileHref} style={row}>
            <span style={{ fontSize: 15 }}>edit profile</span>
            <span aria-hidden="true" className="t-meta">→</span>
          </Link>
        )}
        <button type="button" onClick={signOut} disabled={busy} style={{ ...row, width: "100%", background: "none", border: "none", borderBottom: row.borderBottom, cursor: "pointer", textAlign: "left" }}>
          <span style={{ fontSize: 15 }}>sign out</span>
        </button>
      </section>

      <SectionHeading aside={<span className="t-label">{blocked.length}</span>}>blocked</SectionHeading>
      <section style={{ padding: "0 24px" }}>
        {blocked.length === 0 ? (
          <p className="t-meta">Nobody. Blocked people can’t see your cups or follow you, and you won’t see theirs.</p>
        ) : blocked.map(p => (
          <div key={p.id} style={row}>
            <span style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
              <Avatar user={p} size={32} />
              <span style={{ fontSize: 15, overflow: "hidden", textOverflow: "ellipsis" }}>@{p.username}</span>
            </span>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => unblock(p)}>unblock</button>
          </div>
        ))}
      </section>

      <SectionHeading>about</SectionHeading>
      <section style={{ padding: "0 24px" }}>
        <Link href="/privacy" style={row}><span style={{ fontSize: 15 }}>privacy policy</span><span aria-hidden="true" className="t-meta">→</span></Link>
        <Link href="/terms" style={row}><span style={{ fontSize: 15 }}>terms of use</span><span aria-hidden="true" className="t-meta">→</span></Link>
      </section>

      <SectionHeading>delete account</SectionHeading>
      <section style={{ padding: "0 24px", display: "flex", flexDirection: "column", gap: 12 }}>
        <p className="t-meta" style={{ lineHeight: 1.5 }}>
          Permanently deletes your account on every niche app: your cups, photos, comments, cheers, lists and follows. This can’t be undone.
        </p>
        {!confirming ? (
          <button type="button" className="btn btn-secondary btn-sm" style={{ alignSelf: "flex-start" }} onClick={() => setConfirming(true)}>
            delete my account…
          </button>
        ) : (
          <>
            <label htmlFor="confirm-delete" className="t-label">type delete to confirm</label>
            <input id="confirm-delete" className="field" value={confirmText} onChange={e => setConfirmText(e.target.value)} autoComplete="off" autoCapitalize="off" />
            <button type="button" className="btn btn-primary" disabled={busy || confirmText.trim().toLowerCase() !== "delete"} onClick={deleteAccount}>
              {busy ? "deleting…" : "permanently delete my account"}
            </button>
          </>
        )}
        {error && <p role="alert" className="t-meta">{error}</p>}
      </section>
    </div>
  )
}
