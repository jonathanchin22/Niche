"use client"

import { useState } from "react"
import { createBrowserClient } from "@supabase/ssr"
import { CupSteamSketch, MonoLabel } from "@/components/ui/Primitives"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [mode, setMode] = useState<"login" | "signup">("login")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const supabase = typeof window !== "undefined"
    ? createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""
      )
    : null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    if (!supabase) {
      setError("Supabase is not configured.")
      setLoading(false)
      return
    }

    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(error.message)
      else window.location.href = "/"
    } else {
      const { error } = await supabase.auth.signUp({
        email, password,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      })
      if (error) setError(error.message)
      else setSuccess("Check your email to confirm your account.")
    }

    setLoading(false)
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
          niche coffee
        </h1>
        <MonoLabel>your coffee world</MonoLabel>
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
        {success && (
          <p style={{ fontFamily: "var(--font-hand)", fontSize: 15, color: "var(--c-accent)", marginBottom: 16 }}>
            {success}
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
    </div>
  )
}
