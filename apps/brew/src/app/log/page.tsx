import { createServerSupabaseClient } from "@niche/auth/server"
import { getPlaceById, getUserReviews } from "@niche/database"
import AppShell from "@/components/ui/AppShell"
import ReviewForm, { type RecentPlace } from "@/components/review/ReviewForm"
import { APP_ID, isHomePlace } from "@/lib/brew"

export default async function LogPage({ searchParams }: { searchParams: { place?: string } }) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const [{ data: recent }, place] = await Promise.all([
    getUserReviews(supabase, { user_id: user.id, app_id: APP_ID, limit: 20 }).catch(() => ({ data: [] as any[] })),
    searchParams.place ? getPlaceById(supabase, searchParams.place) : Promise.resolve(null),
  ])

  // Quick picks: the last few distinct cafés this person logged at.
  const seen = new Set<string>()
  const recentPlaces: RecentPlace[] = []
  for (const item of recent as any[]) {
    const p = item.review?.place
    if (!p || isHomePlace(p) || seen.has(p.id)) continue
    seen.add(p.id)
    recentPlaces.push({ id: p.id, name: p.name })
    if (recentPlaces.length === 3) break
  }

  return (
    <AppShell nav={false}>
      <ReviewForm userId={user.id} recentPlaces={recentPlaces} initialPlace={place?.name} />
    </AppShell>
  )
}
