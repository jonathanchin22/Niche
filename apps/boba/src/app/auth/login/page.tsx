"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { signIn, signUp, signInWithOAuth, createClient } from "@niche/auth/client"
import { joinApp } from "@niche/auth/client"
import { BobaSketch } from "@/components/illustrations/BobaSketch"

type Mode = "login" | "signup"

const inputStyle: React.CSSProperties = {
  width: "100%",
  fontFamily: "'DM Sans', system-ui, sans-serif",
  fontSize: 14,
  border: "1px solid #e8e8e4",
  borderRadius: 8,
  padding: "11px 14px",
  background: "white",
  color: "#1a1a1a",
  outline: "none",
}

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
      .eq("app_id", "boba")
      .single()

    if (membership) {
      router.push("/")
    } else {
      // They have an account (from brew/slice) but haven't joined boba yet
      router.push("/join")
    }
  }

  async function handleSubmit() {
    setError(null)
    setLoading(true)
    try {
      if (mode === "signup") {
        await signUp({
          email, password, username,
          display_name: displayName,
          source_app_id: "boba",
        })
        // Auto-creates profile + boba membership via DB trigger
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
      minHeight: "100vh",
      background: "#fafaf8",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "32px 20px",
      maxWidth: 430,
      margin: "0 auto",
    }}>
      {/* App header */}
      <div style={{ textAlign: "center", marginBottom: 36 }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
          <BobaSketch />
        </div>
        <h1 style={{
          fontFamily: "'DM Serif Display', Georgia, serif",
          fontSize: 38, color: "#1a1a1a",
          margin: "0 0 6px", fontWeight: 400, lineHeight: 1,
        }}>
          boba!
        </h1>
        <p style={{
          fontFamily: "'Caveat', cursive",
          fontSize: 16, color: "#888", margin: 0,
        }}>
          bubble tea, ranked by fans
        </p>
      </div>

      {/* Form card */}
      <div style={{
        width: "100%",
        background: "white",
        border: "1px solid #e8e8e4",
        borderRadius: 12,
        padding: "28px 24px",
      }}>
        {/* Mode toggle */}
        <div style={{
          display: "flex",
          background: "#f5f5f3",
          borderRadius: 8,
          padding: 3,
          marginBottom: 20,
        }}>
          {(["login", "signup"] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              style={{
                flex: 1,
                padding: "8px 0",
                borderRadius: 6,
                fontFamily: "'DM Sans', system-ui, sans-serif",
                fontSize: 13,
                fontWeight: mode === m ? 600 : 400,
                background: mode === m ? "white" : "transparent",
                color: mode === m ? "#1a1a1a" : "#888",
                border: mode === m ? "1px solid #e8e8e4" : "1px solid transparent",
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              {m === "login" ? "sign in" : "join"}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {mode === "signup" && (
            <>
              <input
                placeholder="Display name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                style={inputStyle}
              />
              <input
                placeholder="Username (e.g. teafairy)"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase())}
                style={inputStyle}
              />
            </>
          )}
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={inputStyle}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={inputStyle}
          />

          {error && (
            <p style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 12, color: "#c04040", margin: 0 }}>
              {error}
            </p>
          )}

          <button
            onClick={handleSubmit}
            disabled={loading}
            style={{
              width: "100%",
              background: "#2d6a4f",
              color: "white",
              fontFamily: "'DM Sans', system-ui, sans-serif",
              fontWeight: 600,
              fontSize: 14,
              padding: "13px 0",
              borderRadius: 8,
              border: "none",
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.6 : 1,
              marginTop: 4,
            }}
          >
            {loading ? "..." : mode === "login" ? "sign in →" : "create account →"}
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "4px 0" }}>
            <div style={{ flex: 1, height: 1, background: "#e8e8e4" }} />
            <span style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 11, color: "#bbb" }}>or</span>
            <div style={{ flex: 1, height: 1, background: "#e8e8e4" }} />
          </div>

          <button
            onClick={() => handleOAuth("google")}
            style={{
              width: "100%",
              border: "1px solid #e8e8e4",
              borderRadius: 8,
              padding: "12px 0",
              fontFamily: "'DM Sans', system-ui, sans-serif",
              fontSize: 13,
              color: "#888",
              background: "transparent",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            <span style={{ fontWeight: 700 }}>G</span> Continue with Google
          </button>
        </div>
      </div>

      <p style={{
        fontFamily: "'DM Sans', system-ui, sans-serif",
        fontSize: 12,
        color: "#888",
        marginTop: 20,
        textAlign: "center",
        maxWidth: 280,
      }}>
        Already on brew. or slice.?{" "}
        <button
          onClick={() => setMode("login")}
          style={{ color: "#2d6a4f", fontWeight: 600, background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: "inherit", fontSize: "inherit" }}
        >
          Sign in →
        </button>
        {" "}— your account works across all niche apps.
      </p>
    </div>
  )
}
