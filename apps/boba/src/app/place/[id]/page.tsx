import { createServerSupabaseClient } from "@niche/auth"
import { PlaceClient } from "./PlaceClient"
import { getPlaceById, getPlaceReviews } from "@niche/database"
import { notFound } from "next/navigation"

export default async function PlacePage({ params }: { params: { id: string } }) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [place, reviewsResult] = await Promise.all([
    getPlaceById(supabase as any, params.id).catch(() => null),
    getPlaceReviews(supabase as any, { place_id: params.id }).catch(() => []),
  ])

  if (!place) notFound()

  const reviews = reviewsResult.map((item: any) => item.review)

  return <PlaceClient place={place} reviews={reviews as any[]} userId={user?.id ?? null} />
}
