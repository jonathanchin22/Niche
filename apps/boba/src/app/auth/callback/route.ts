import { createServerSupabaseClient } from "@niche/auth"
import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  // Only same-site paths: "//evil.com" or "@evil.com" would otherwise send
  // people off-site after signing in.
  const requested = searchParams.get("next") ?? "/"
  const next = requested.startsWith("/") && !requested.startsWith("//") && !requested.startsWith("/\\") ? requested : "/"

  if (code) {
    const supabase = await createServerSupabaseClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
      console.error("auth callback: code exchange failed:", error.message)
      return NextResponse.redirect(`${origin}/auth/login`)
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: membership } = await supabase
        .from("app_memberships")
        .select("user_id")
        .eq("user_id", user.id)
        .eq("app_id", "boba")
        .maybeSingle()

      if (!membership) {
        return NextResponse.redirect(`${origin}/join`)
      }
    }
  }

  return NextResponse.redirect(`${origin}${next}`)
}
