import { createServerSupabaseClient } from "@niche/auth/server"
import { getPlaceById, getPlaceReviews } from "@niche/database"
import AppShell from "@/components/ui/AppShell"
import PlaceClient from "./PlaceClient"
import { notFound } from "next/navigation"
import type { Review } from "@niche/shared-types"

interface Props {
  params: Promise<{ id: string }>
}

export default async function PlacePage({ params }: Props) {
  const { id } = await params
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const [place, reviewItems] = await Promise.all([
    getPlaceById(supabase, id),
    getPlaceReviews(supabase, { place_id: id, limit: 20 }),
  ])

  if (!place) notFound()

  const reviews = reviewItems.map(i => i.review).filter((r): r is Review => r !== null && r !== undefined)

  return (
    <AppShell>
      <PlaceClient place={place} reviews={reviews} userId={user.id} />
    </AppShell>
  )
}
