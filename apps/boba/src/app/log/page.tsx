import { getServerSession } from "@niche/auth/server"
import { getPlaceById, getUserReviews } from "@niche/database"
import type { Place } from "@niche/shared-types"
import AppShell from "@/components/ui/AppShell"
import ReviewForm, { type RecentPlace } from "@/components/review/ReviewForm"
import { APP_ID, isHomePlace, type Cup } from "@/lib/boba"

function toRecent(p: Pick<Place, "id" | "name" | "address" | "city" | "state" | "lat" | "lng" | "google_place_id">): RecentPlace {
  return {
    id: p.id, name: p.name, address: p.address ?? "", city: p.city ?? "", state: p.state ?? "",
    lat: Number(p.lat ?? 0), lng: Number(p.lng ?? 0), google_place_id: p.google_place_id ?? null,
  }
}

export default async function LogPage({ searchParams }: { searchParams: { place?: string } }) {
  const { supabase, user } = await getServerSession()
  if (!user) return null

  const [{ data: recent }, place] = await Promise.all([
    getUserReviews(supabase, { user_id: user.id, app_id: APP_ID, limit: 20 }).catch(() => ({ data: [] })),
    searchParams.place ? getPlaceById(supabase, searchParams.place) : Promise.resolve(null),
  ])

  // Quick picks: the last few distinct shops this person logged at.
  const seen = new Set<string>()
  const recentPlaces: RecentPlace[] = []
  for (const item of recent) {
    const p = (item.review as Cup | undefined)?.place as Place | undefined
    if (!p || isHomePlace(p) || seen.has(p.id)) continue
    seen.add(p.id)
    recentPlaces.push(toRecent(p))
    if (recentPlaces.length === 3) break
  }

  return (
    <AppShell nav={false}>
      <ReviewForm userId={user.id} recentPlaces={recentPlaces} initialPlace={place && !isHomePlace(place) ? toRecent(place) : null} />
    </AppShell>
  )
}
