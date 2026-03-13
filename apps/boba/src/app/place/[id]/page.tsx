import { createServerSupabaseClient } from "@niche/auth"
import { PlaceClient } from "./PlaceClient"
import { getPlaceById, getPlaceReviews } from "@niche/database"
import { notFound } from "next/navigation"

export default async function PlacePage({ params }: { params: { id: string } }) {
  const supabase = await createServerSupabaseClient()

  const [place, reviews] = await Promise.all([
    getPlaceById(supabase as any, { place_id: params.id, app_id: "boba" }).catch(() => null),
    getPlaceReviews(supabase as any, { place_id: params.id, app_id: "boba" }).catch(() => []),
  ])

  if (!place) notFound()

  return <PlaceClient place={place} reviews={reviews as any[]} />
}
