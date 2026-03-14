import { createServerSupabaseClient } from "@niche/auth/server"
import { getProfile, getFollowing, getFollowers } from "@niche/database"
import AppShell from "@/components/ui/AppShell"
import ProfileClient from "./ProfileClient"

export default async function ProfilePage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const [profile, following, followers] = await Promise.all([
    getProfile(supabase, user.id),
    getFollowing(supabase, user.id),
    getFollowers(supabase, user.id),
  ])

  return (
    <AppShell>
      <ProfileClient
        profile={profile}
        userId={user.id}
        followingCount={following.length}
        followerCount={followers.length}
      />
    </AppShell>
  )
}
