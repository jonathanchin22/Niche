import { createServerSupabaseClient } from "@niche/auth/server"
import { getProfile, getFollowing, getFollowers, getHighestRatedCoffee } from "@niche/database"
import AppShell from "@/components/ui/AppShell"
import ProfileClient from "./ProfileClient"

const APP_ID = "brew" as const

export default async function ProfilePage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const [profile, following, followers, highestRatedCoffee] = await Promise.all([
    getProfile(supabase, user.id),
    getFollowing(supabase, user.id),
    getFollowers(supabase, user.id),
    getHighestRatedCoffee(supabase, { user_id: user.id, app_id: APP_ID }),
  ])

  return (
    <AppShell>
      <ProfileClient
        profile={profile}
        userId={user.id}
        profileUserId={user.id}
        followingCount={following.length}
        followerCount={followers.length}
        highestRatedCoffee={highestRatedCoffee}
        showOwnActions
      />
    </AppShell>
  )
}
