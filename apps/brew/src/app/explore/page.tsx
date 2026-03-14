import { createServerSupabaseClient } from "@niche/auth/server"
import AppShell from "@/components/ui/AppShell"
import ExploreClient from "./ExploreClient"

export default async function ExplorePage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  return (
    <AppShell>
      <ExploreClient userId={user.id} />
    </AppShell>
  )
}
