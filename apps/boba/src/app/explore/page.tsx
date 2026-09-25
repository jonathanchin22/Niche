import { getServerSession } from "@niche/auth/server"
import { getFirstReviewCount, getFriendsLovedPlaces } from "@niche/database"
import AppShell from "@/components/ui/AppShell"
import ExploreClient from "./ExploreClient"
import { APP_ID } from "@/lib/boba"

export default async function ExplorePage() {
  const { supabase, user } = await getServerSession()
  if (!user) return null

  const [places, firsts] = await Promise.all([
    getFriendsLovedPlaces(supabase, { user_id: user.id, app_id: APP_ID }).catch(() => []),
    getFirstReviewCount(supabase, { user_id: user.id, app_id: APP_ID }).catch(() => 0),
  ])

  return (
    <AppShell>
      <ExploreClient places={places} firsts={firsts} />
    </AppShell>
  )
}
