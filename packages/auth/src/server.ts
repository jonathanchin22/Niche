import { createServerClient } from "@supabase/ssr"
import { cache } from "react"
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

// ─── Signed-in user for Server Components ────────────────────────────────────
// getClaims() verifies the session JWT locally against the project's
// asymmetric signing keys (cached JWKS), so pages don't make a round trip to
// the Auth server on every render the way getUser() does. cache() shares one
// client and one verification across everything rendered for a request.
export const getServerSession = cache(async () => {
  const supabase = await createServerSupabaseClient()
  const { data } = await supabase.auth.getClaims()
  const claims = data?.claims
  const user = claims?.sub ? { id: claims.sub, email: (claims.email as string | undefined) ?? null } : null
  return { supabase, user }
})
