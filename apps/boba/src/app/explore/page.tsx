import { createServerSupabaseClient } from "@niche/auth/server"
import { getFriendsLovedPlaces } from "@niche/database"
import AppShell from "@/components/ui/AppShell"
import ExploreClient from "./ExploreClient"
import { APP_ID } from "@/lib/boba"

export default async function ExplorePage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const places = await getFriendsLovedPlaces(supabase, { user_id: user.id, app_id: APP_ID }).catch(() => [])

  return (
    <AppShell>
      <ExploreClient places={places} />
    </AppShell>
  )
}
