import { notFound, redirect } from "next/navigation"
import { createServerSupabaseClient } from "@niche/auth/server"
import { isFollowing } from "@niche/database"
import AppShell from "@/components/ui/AppShell"
import ProfileView from "@/components/profile/ProfileView"

export default async function ProfileByUsernamePage({ params, searchParams }: {
  params: { username: string }
  searchParams: { tab?: string }
}) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("username", decodeURIComponent(params.username))
    .maybeSingle()
  if (!profile) notFound()
  if (profile.id === user.id) redirect("/profile")

  const following = await isFollowing(supabase, { follower_id: user.id, following_id: profile.id })
  const tab = searchParams.tab === "cafes" ? "cafes" : "cups"

  return (
    <AppShell>
      <ProfileView supabase={supabase} viewerId={user.id} profile={profile} tab={tab} isFollowing={following} />
    </AppShell>
  )
}
