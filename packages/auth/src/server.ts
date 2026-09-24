import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

// ─── Server-side Supabase client (used in Server Components / Route Handlers) ─
export async function createServerSupabaseClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          // Server Components can't write cookies — the middleware refreshes the
          // session instead, so it's safe to ignore the error there.
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
          } catch {}
        },
      },
    }
  )
}
