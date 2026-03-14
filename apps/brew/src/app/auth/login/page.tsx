"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { signIn, signUp, signInWithOAuth, createClient } from "@niche/auth/client"
import { CupSteamSketch, MonoLabel } from "@/components/ui/Primitives"

type Mode = "login" | "signup"

export default function LoginPage() {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>("login")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [username, setUsername] = useState("")
  const [displayName, setDisplayName] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // After any successful auth, check membership and route appropriately
  async function handlePostAuth() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: membership } = await supabase
      .from("app_memberships")
      .select("user_id")
      .eq("user_id", user.id)
      .eq("app_id", "brew")
      .single()

    if (membership) {
      router.push("/")
    } else {
      // They have an account (from boba/slice) but haven't joined brew yet
      router.push("/join")
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      if (mode === "signup") {
        await signUp({
          email, password, username,
          display_name: displayName,
          source_app_id: "brew",
        })
        // Auto-creates profile + brew membership via DB trigger
        router.push("/")
      } else {
        await signIn({ email, password })
        await handlePostAuth()
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Something went wrong")
    } finally {
      setLoading(false)
    }
  }

  async function handleOAuth(provider: "google" | "apple") {
    const redirectTo = `${window.location.origin}/auth/callback`
    await signInWithOAuth(provider, redirectTo)
  }

  return (
    <div style={{
      minHeight: "100svh", background: "var(--c-bg)",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      padding: "40px 28px",
      maxWidth: 430, margin: "0 auto",
    }}>
      {/* Logo */}
      <div style={{ marginBottom: 32, textAlign: "center" }}>
        <CupSteamSketch size={60} />
        <h1 style={{
          fontFamily: "var(--font-display)", fontSize: 36, color: "var(--c-ink)",
          fontWeight: 400, fontStyle: "italic", margin: "16px 0 4px",
        }}>
          niche brew
        </h1>
        <MonoLabel>your brew world</MonoLabel>
      </div>

      {/* Toggle */}
      <div style={{ display: "flex", border: "1px solid var(--c-rule)", borderRadius: 2, marginBottom: 28, overflow: "hidden" }}>
        {(["login", "signup"] as const).map(m => (
          <button key={m} type="button" onClick={() => setMode(m)} style={{
            flex: 1, padding: "10px 24px",
            background: mode === m ? "var(--c-accent)" : "transparent",
            color: mode === m ? "#fff" : "var(--c-subtle)",
            border: "none", cursor: "pointer",
            fontFamily: "var(--font-mono)", fontSize: 10,
            letterSpacing: "0.1em", textTransform: "uppercase",
          }}>
            {m}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} style={{ width: "100%" }}>
        {mode === "signup" && (
          <>
            <div style={{ marginBottom: 24 }}>
              <MonoLabel style={{ marginBottom: 10 }}>display name</MonoLabel>
              <input
                type="text"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                placeholder="Your Name"
                required
                style={{
                  width: "100%", fontFamily: "var(--font-display)", fontSize: 20,
                  border: "none", borderBottom: "1px solid var(--c-rule)",
                  padding: "8px 0", background: "transparent",
                  color: "var(--c-ink)", outline: "none", fontStyle: "italic",
                }}
              />
            </div>
            <div style={{ marginBottom: 24 }}>
              <MonoLabel style={{ marginBottom: 10 }}>username</MonoLabel>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value.toLowerCase())}
                placeholder="e.g. brewmaster"
                required
                style={{
                  width: "100%", fontFamily: "var(--font-display)", fontSize: 20,
                  border: "none", borderBottom: "1px solid var(--c-rule)",
                  padding: "8px 0", background: "transparent",
                  color: "var(--c-ink)", outline: "none", fontStyle: "italic",
                }}
              />
            </div>
          </>
        )}
        {[
          { label: "email", type: "email", val: email, set: setEmail, ph: "you@example.com" },
          { label: "password", type: "password", val: password, set: setPassword, ph: "••••••••" },
        ].map(({ label, type, val, set, ph }) => (
          <div key={label} style={{ marginBottom: 24 }}>
            <MonoLabel style={{ marginBottom: 10 }}>{label}</MonoLabel>
            <input
              type={type}
              value={val}
              onChange={e => set(e.target.value)}
              placeholder={ph}
              required
              style={{
                width: "100%", fontFamily: "var(--font-display)", fontSize: 20,
                border: "none", borderBottom: "1px solid var(--c-rule)",
                padding: "8px 0", background: "transparent",
                color: "var(--c-ink)", outline: "none", fontStyle: "italic",
              }}
            />
          </div>
        ))}

        {error && (
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "#c0392b", letterSpacing: "0.05em", marginBottom: 16 }}>
            {error}
          </p>
        )}

        <button type="submit" disabled={loading} style={{
          width: "100%", background: "var(--c-accent)", color: "#fff",
          border: "none", padding: "16px",
          fontFamily: "var(--font-mono)", fontSize: 11,
          cursor: loading ? "not-allowed" : "pointer",
          letterSpacing: "0.1em", textTransform: "uppercase",
          opacity: loading ? 0.6 : 1,
        }}>
          {loading ? "..." : mode === "login" ? "sign in →" : "create account →"}
        </button>
      </form>

      <p style={{ fontFamily: "var(--font-hand)", fontSize: 13, color: "var(--c-subtle)", marginTop: 24, textAlign: "center" }}>
        Already on boba or slice?{" "}
        <button onClick={() => setMode("login")} style={{ color: "var(--c-accent)", textDecoration: "underline", background: "none", border: "none", cursor: "pointer" }}>
          Sign in →
        </button>
        {" "}— your account works across all niche apps.
      </p>
    </div>
  )
}
