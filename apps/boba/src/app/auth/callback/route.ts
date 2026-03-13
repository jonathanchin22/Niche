import { createServerSupabaseClient } from "@niche/auth"
import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  const next = searchParams.get("next") ?? "/"

  if (code) {
    const supabase = await createServerSupabaseClient()
    await supabase.auth.exchangeCodeForSession(code)

    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: membership } = await supabase
        .from("app_memberships")
        .select("user_id")
        .eq("user_id", user.id)
        .eq("app_id", "boba")
        .single()

      if (!membership) {
        return NextResponse.redirect(`${origin}/join`)
      }
    }
  }

  return NextResponse.redirect(`${origin}${next}`)
}
