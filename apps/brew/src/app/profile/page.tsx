import { createServerSupabaseClient } from "@niche/auth/server"
import { getProfile } from "@niche/database"
import AppShell from "@/components/ui/AppShell"
import ProfileView from "@/components/profile/ProfileView"

export default async function ProfilePage({ searchParams }: { searchParams: { tab?: string } }) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const profile = await getProfile(supabase, user.id)
  if (!profile) return null

  const tab = searchParams.tab === "try" || searchParams.tab === "cafes" ? searchParams.tab : "cups"
  return (
    <AppShell>
      <ProfileView supabase={supabase} viewerId={user.id} profile={profile} tab={tab} />
    </AppShell>
  )
}
