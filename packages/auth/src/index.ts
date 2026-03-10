import { createBrowserClient, createServerClient } from "@supabase/ssr"
import type { AppId, User, AppMembership } from "@niche/shared-types"
import type { cookies } from "next/headers"

// ─── Client-side Supabase client (used in React components) ──────────────────
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// ─── Server-side Supabase client (used in Server Components / Route Handlers) ─
export function createServerSupabaseClient(cookieStore: ReturnType<typeof cookies>) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name) { return cookieStore.get(name)?.value },
        set(name, value, options) {
          try { cookieStore.set({ name, value, ...options }) } catch {}
        },
        remove(name, options) {
          try { cookieStore.set({ name, value: "", ...options }) } catch {}
        },
      },
    }
  )
}

// ─── Sign up — creates the shared account ────────────────────────────────────
// Called once, regardless of which app the user first signs up through.
// The app_id is recorded so we know where they came from.
export async function signUp({
  email,
  password,
  username,
  display_name,
  source_app_id,
}: {
  email: string
  password: string
  username: string
  display_name: string
  source_app_id: AppId
}) {
  const supabase = createClient()

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        username,
        display_name,
        source_app_id,
      },
    },
  })

  if (error) throw error

  // The DB trigger (see migrations) auto-creates the profile row
  // and initial app_membership for source_app_id on user creation.
  return data
}

// ─── Sign in ──────────────────────────────────────────────────────────────────
export async function signIn({ email, password }: { email: string; password: string }) {
  const supabase = createClient()
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

// ─── Sign in with Google / Apple (OAuth) ─────────────────────────────────────
export async function signInWithOAuth(provider: "google" | "apple", redirectTo: string) {
  const supabase = createClient()
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo },
  })
  if (error) throw error
  return data
}

// ─── Sign out ─────────────────────────────────────────────────────────────────
export async function signOut() {
  const supabase = createClient()
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

// ─── Get current session user ─────────────────────────────────────────────────
export async function getCurrentUser(): Promise<User | null> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from("profiles")
    .select("*, app_memberships(*)")
    .eq("id", user.id)
    .single()

  return data as User | null
}

// ─── Join a new app with an existing account ──────────────────────────────────
// This is the "Continue as Maya →" flow.
// Called when a user with an existing account opens a new niche app.
export async function joinApp(app_id: AppId): Promise<AppMembership> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  // Upsert — safe to call multiple times
  const { data, error } = await supabase
    .from("app_memberships")
    .upsert(
      { user_id: user.id, app_id, xp: 0, badges: [] },
      { onConflict: "user_id,app_id", ignoreDuplicates: true }
    )
    .select()
    .single()

  if (error) throw error
  return data as AppMembership
}

// ─── Check if user is a member of a specific app ─────────────────────────────
export async function isAppMember(app_id: AppId): Promise<boolean> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false

  const { data } = await supabase
    .from("app_memberships")
    .select("user_id")
    .eq("user_id", user.id)
    .eq("app_id", app_id)
    .single()

  return !!data
}
