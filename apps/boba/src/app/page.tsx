import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { createServerSupabaseClient } from "@niche/auth"
import { getFriendFeed } from "@niche/database"
import { FeedClient } from "@/components/feed/FeedClient"

export default async function HomePage() {
  const supabase = await createServerSupabaseClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const { data: membership } = await supabase
    .from("app_memberships")
    .select("*")
    .eq("user_id", user.id)
    .eq("app_id", "boba")
    .single()

  if (!membership) redirect("/join")

  // Cast to any to avoid Supabase generic type mismatch between packages
  const initialFeed = await getFriendFeed(supabase as any, {
    user_id: user.id,
    app_id: "boba",
  })

  return <FeedClient initialData={initialFeed} userId={user.id} />
}