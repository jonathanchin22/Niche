import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { createServerSupabaseClient } from "@niche/auth"
import { getFriendFeed } from "@niche/database"
import { FeedClient } from "@/components/feed/FeedClient"

export default async function HomePage() {
  const cookieStore = cookies()
  const supabase = createServerSupabaseClient(cookieStore)

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  // Verify boba membership
  const { data: membership } = await supabase
    .from("app_memberships")
    .select("*")
    .eq("user_id", user.id)
    .eq("app_id", "boba")
    .single()

  // If they have an account but haven't joined boba yet, show join screen
  if (!membership) redirect("/join")

  // Fetch initial feed data server-side for fast first load
  const initialFeed = await getFriendFeed(supabase, {
    user_id: user.id,
    app_id: "boba",
  })

  return <FeedClient initialData={initialFeed} userId={user.id} />
}
