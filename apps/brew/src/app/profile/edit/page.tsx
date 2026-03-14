import { createServerSupabaseClient } from "@niche/auth/server"
import { getProfile } from "@niche/database"
import AppShell from "@/components/ui/AppShell"
import EditProfileClient from "./EditProfileClient"

export default async function EditProfilePage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const profile = await getProfile(supabase, user.id)
  if (!profile) return null

  return (
    <AppShell>
      <EditProfileClient profile={profile} userId={user.id} />
    </AppShell>
  )
}
