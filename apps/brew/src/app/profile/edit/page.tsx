import { createServerSupabaseClient } from "@niche/auth/server"
import { getProfile, getHighestRatedCoffee } from "@niche/database"
import AppShell from "@/components/ui/AppShell"
import EditProfileClient from "./EditProfileClient"

const APP_ID = "brew" as const

export default async function EditProfilePage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const [profile, highestRatedCoffee] = await Promise.all([
    getProfile(supabase, user.id),
    getHighestRatedCoffee(supabase, { user_id: user.id, app_id: APP_ID }),
  ])
  if (!profile) return null

  return (
    <AppShell>
      <EditProfileClient profile={profile} userId={user.id} highestRatedCoffee={highestRatedCoffee} />
    </AppShell>
  )
}
