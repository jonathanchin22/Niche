import { redirect } from "next/navigation"
import { createServerSupabaseClient } from "@niche/auth"
import { getFriendFeed } from "@niche/database"
import { FeedClient } from "@/components/feed/FeedClient"
import { APP_ID } from "@/lib/app-id"

export default async function HomePage() {
  const supabase = await createServerSupabaseClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const { data: membership } = await supabase
    .from("app_memberships")
    .select("*")
    .eq("user_id", user.id)
    .eq("app_id", APP_ID)
    .maybeSingle()

  if (!membership) redirect("/join")

  const initialFeed = await getFriendFeed(supabase, {
    user_id: user.id,
    app_id: APP_ID,
  })

  return <FeedClient initialData={initialFeed} userId={user.id} />
}