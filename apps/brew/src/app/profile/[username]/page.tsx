import { createServerSupabaseClient } from "@niche/auth/server"
import { getFollowing, getFollowers, getHighestRatedCoffee } from "@niche/database"
import { redirect, notFound } from "next/navigation"
import AppShell from "@/components/ui/AppShell"
import ProfileClient from "../ProfileClient"

const APP_ID = "brew" as const

interface ProfileByUsernamePageProps {
  params: { username: string }
}

export default async function ProfileByUsernamePage({ params }: ProfileByUsernamePageProps) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const username = decodeURIComponent(params.username)
  const { data: profile } = await (supabase as any)
    .from("profiles")
    .select("*")
    .eq("username", username)
    .maybeSingle()

  if (!profile) notFound()

  const [following, followers, highestRatedCoffee] = await Promise.all([
    getFollowing(supabase, profile.id),
    getFollowers(supabase, profile.id),
    getHighestRatedCoffee(supabase, { user_id: profile.id, app_id: APP_ID }),
  ])

  return (
    <AppShell>
      <ProfileClient
        profile={profile}
        userId={user.id}
        profileUserId={profile.id}
        followingCount={following.length}
        followerCount={followers.length}
        highestRatedCoffee={highestRatedCoffee}
        showOwnActions={user.id === profile.id}
        showBackButton={user.id !== profile.id}
      />
    </AppShell>
  )
}
