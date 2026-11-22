"use client"

import { track } from "@niche/analytics"
import { rememberInvite } from "@niche/database"
import Link from "next/link"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { claimInvite } from "@/app/actions"

type Mode = "signed-out" | "join" | "follow" | "following"

/** The invite page's one button, for whichever state the visitor is in. */
export default function InviteActions({ code, name, username, mode }: {
  code: string
  name: string
  username: string
  mode: Mode
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { track("invite_opened", { signed_in: mode !== "signed-out" }) }, [mode])

  // Not signed in, or not on boba yet: remember the link, then sign in or join.
  // It's claimed as soon as they land in the app (PendingInvite).
  function continueToJoin() {
    setBusy(true)
    rememberInvite(code)
    router.push(mode === "join" ? "/join" : "/auth/login")
  }

  async function follow() {
    setBusy(true)
    setError(null)
    try {
      const result = await claimInvite(code)
      if (result?.status !== "ok") throw new Error("invite not accepted")
      track("invite_accepted", { mutual: result.mutual, credited: result.credited, via: "link" })
      router.push(`/profile/${username}?tab=ranked`)
    } catch {
      setError("Couldn’t follow just now — try again.")
      setBusy(false)
    }
  }

  if (mode === "following") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <p className="t-meta" style={{ textAlign: "center" }}>you already follow {name} ✓</p>
        <Link href={`/profile/${username}?tab=ranked`} className="btn btn-primary">see {name}&rsquo;s ranked list</Link>
      </div>
    )
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <button type="button" className="btn btn-primary" disabled={busy} onClick={mode === "follow" ? follow : continueToJoin}>
        {busy ? "one sec…" : mode === "follow" ? `follow ${name}` : `join ${name} on boba!`}
      </button>
      <p className="t-meta" style={{ textAlign: "center", lineHeight: 1.5 }}>
        {mode === "signed-out"
          ? `you'll follow each other, so ${name}'s sips are waiting when you get in.`
          : `${name}'s sips will show up on your home.`}
      </p>
      {error && <p role="alert" className="t-meta" style={{ textAlign: "center" }}>{error}</p>}
    </div>
  )
}
