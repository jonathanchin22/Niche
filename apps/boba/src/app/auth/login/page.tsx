"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { signIn, signUp, signInWithOAuth, createClient } from "@niche/auth/client"
import { joinApp } from "@niche/auth/client"

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
    <div className="min-h-screen bg-gradient-to-b from-boba-soft to-white flex flex-col items-center justify-center p-6">
      {/* App icon */}
      <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-boba-accent to-purple-800 flex items-center justify-center text-4xl shadow-xl shadow-boba-accent/30 mb-6">
        🧋
      </div>
      <h1 className="text-3xl font-black text-boba-text mb-1">boba!</h1>
      <p className="text-sm text-boba-tertiary mb-8">bubble tea, ranked by fans</p>

      {/* Form card */}
      <div className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-xl">
        {/* Mode toggle */}
        <div className="flex bg-boba-soft rounded-2xl p-1 mb-5">
          {(["login", "signup"] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${
                mode === m
                  ? "bg-boba-accent text-white shadow-md shadow-boba-accent/30"
                  : "text-boba-secondary"
              }`}
            >
              {m === "login" ? "Sign in" : "Join"}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-3">
          {mode === "signup" && (
            <>
              <input
                placeholder="Display name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full bg-gray-50 border border-boba-divider rounded-xl px-4 py-3 text-sm text-boba-text outline-none focus:border-boba-accent transition-colors"
              />
              <input
                placeholder="Username (e.g. teafairy)"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase())}
                className="w-full bg-gray-50 border border-boba-divider rounded-xl px-4 py-3 text-sm text-boba-text outline-none focus:border-boba-accent transition-colors"
              />
            </>
          )}
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-gray-50 border border-boba-divider rounded-xl px-4 py-3 text-sm text-boba-text outline-none focus:border-boba-accent transition-colors"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-gray-50 border border-boba-divider rounded-xl px-4 py-3 text-sm text-boba-text outline-none focus:border-boba-accent transition-colors"
          />

          {error && (
            <p className="text-red-500 text-xs px-1">{error}</p>
          )}

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full bg-boba-accent text-white font-bold rounded-xl py-3.5 text-sm shadow-lg shadow-boba-accent/40 disabled:opacity-60 transition-opacity mt-1"
          >
            {loading ? "..." : mode === "login" ? "Sign in →" : "Create account →"}
          </button>

          <div className="flex items-center gap-3 my-1">
            <div className="flex-1 h-px bg-boba-divider" />
            <span className="text-xs text-boba-tertiary">or</span>
            <div className="flex-1 h-px bg-boba-divider" />
          </div>

          <button
            onClick={() => handleOAuth("google")}
            className="w-full border border-boba-divider rounded-xl py-3 text-sm font-bold text-boba-secondary flex items-center justify-center gap-2"
          >
            <span>G</span> Continue with Google
          </button>
        </div>
      </div>

      <p className="text-xs text-boba-tertiary mt-6 text-center max-w-xs">
        Already on brew. or slice.?{" "}
        <button onClick={() => setMode("login")} className="text-boba-accent font-bold">
          Sign in →
        </button>
        {" "}— your account works across all niche apps.
      </p>
    </div>
  )
}
