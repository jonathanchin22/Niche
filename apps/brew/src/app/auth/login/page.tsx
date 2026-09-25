"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient, signIn, signInWithOAuth, signUp } from "@niche/auth/client"

type Mode = "login" | "signup"

export default function LoginPage() {
  const router = useRouter()
  const [showEmail, setShowEmail] = useState(false)
  const [mode, setMode] = useState<Mode>("login")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [username, setUsername] = useState("")
  const [displayName, setDisplayName] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // After signing in, send people who haven't joined brew yet to the one-tap join screen.
  async function routeAfterAuth() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: membership } = await supabase
      .from("app_memberships")
      .select("user_id")
      .eq("user_id", user.id)
      .eq("app_id", "brew")
      .maybeSingle()
    router.push(membership ? "/" : "/join")
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      if (mode === "signup") {
        await signUp({ email, password, username, display_name: displayName, source_app_id: "brew" })
        router.push("/")
      } else {
        await signIn({ email, password })
        await routeAfterAuth()
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setLoading(false)
    }
  }

  async function handleGoogle() {
    setError(null)
    try {
      await signInWithOAuth("google", `${window.location.origin}/auth/callback`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Couldn't reach Google")
    }
  }

  return (
    <div style={{ minHeight: "100svh", maxWidth: 430, margin: "0 auto", display: "flex", flexDirection: "column", paddingBottom: 28 }}>
      {!showEmail && (
        <img src="/img/signin.jpg" alt="Two lattes on a wooden table among plants" style={{ width: "100%", height: "46svh", minHeight: 280, objectFit: "cover", background: "var(--c-tint)" }} />
      )}

      <section style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: showEmail ? "72px 24px 0" : "30px 24px 0", textAlign: "center" }}>
        <span className="t-display" style={{ fontStyle: "italic", fontSize: 76, lineHeight: 0.85 }}>brew.</span>
        <p className="t-hand" style={{ fontSize: 23, color: "var(--c-mid)" }}>every cup, remembered</p>
      </section>

      {!showEmail ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "26px 24px 0" }}>
          <button type="button" onClick={handleGoogle} className="btn btn-primary">continue with Google</button>
          <button type="button" onClick={() => setShowEmail(true)} className="btn btn-secondary">use email instead</button>
          {error && <p role="alert" className="t-meta" style={{ textAlign: "center" }}>{error}</p>}
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12, padding: "28px 24px 0" }}>
          <div role="tablist" aria-label="Sign in or create an account" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", marginBottom: 6 }}>
            {(["login", "signup"] as Mode[]).map(m => (
              <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => { setMode(m); setError(null) }} style={{
                height: 44, background: "none", border: "none", cursor: "pointer", fontSize: 14,
                fontWeight: mode === m ? 500 : 400, color: mode === m ? "var(--c-ink)" : "var(--c-mid)",
                borderBottom: mode === m ? "1.5px solid var(--c-ink)" : "1px solid var(--c-rule)",
              }}>
                {m === "login" ? "sign in" : "create account"}
              </button>
            ))}
          </div>

          {mode === "signup" && (
            <>
              <label className="sr-only" htmlFor="username">Username</label>
              <input id="username" className="field" value={username} onChange={e => setUsername(e.target.value)} placeholder="username" autoCapitalize="none" autoComplete="username" required />
              <label className="sr-only" htmlFor="display">Your name</label>
              <input id="display" className="field" value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="your name" autoComplete="name" />
            </>
          )}
          <label className="sr-only" htmlFor="email">Email</label>
          <input id="email" className="field" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email" autoComplete="email" required />
          <label className="sr-only" htmlFor="password">Password</label>
          <input id="password" className="field" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="password" autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={6} required />

          {error && <p role="alert" className="t-meta">{error}</p>}

          <button type="submit" disabled={loading} className="btn btn-primary" style={{ marginTop: 6 }}>
            {loading ? "one moment…" : mode === "login" ? "sign in" : "create account"}
          </button>
          <button type="button" onClick={() => { setShowEmail(false); setError(null) }} className="t-meta" style={{ height: 44, background: "none", border: "none", cursor: "pointer" }}>
            ← back
          </button>
        </form>
      )}

      <p className="t-label" style={{ marginTop: "auto", paddingTop: 28, textAlign: "center", letterSpacing: "0.14em" }}>one niche account · brew &amp; boba</p>
    </div>
  )
}
