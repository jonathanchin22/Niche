import { notFound, redirect } from "next/navigation"
import { getServerSession } from "@niche/auth/server"
import { isBlocking, isFollowing } from "@niche/database"
import AppShell from "@/components/ui/AppShell"
import ProfileView from "@/components/profile/ProfileView"

export default async function ProfileByUsernamePage({ params, searchParams }: {
  params: { username: string }
  searchParams: { tab?: string }
}) {
  const { supabase, user } = await getServerSession()
  if (!user) redirect("/auth/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url, bio, location, created_at")
    .eq("username", decodeURIComponent(params.username))
    .maybeSingle()
  if (!profile) notFound()
  if (profile.id === user.id) redirect("/profile")

  const [following, blocked] = await Promise.all([
    isFollowing(supabase, { follower_id: user.id, following_id: profile.id }),
    isBlocking(supabase, { blocker_id: user.id, blocked_id: profile.id }).catch(() => false),
  ])
  const tab = searchParams.tab === "cafes" || searchParams.tab === "ranked" ? searchParams.tab : "cups"

  return (
    <AppShell>
      <ProfileView supabase={supabase} viewerId={user.id} profile={profile} tab={tab} isFollowing={following} isBlocked={blocked} />
    </AppShell>
  )
}
