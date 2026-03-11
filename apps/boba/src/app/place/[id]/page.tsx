import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { createServerSupabaseClient } from "@niche/auth"
import { getPlaceById, getPlaceReviews } from "@niche/database"
import PlaceClient from "./PlaceClient"

export default async function PlacePage({ params }: { params: { id: string } }) {
  const cookieStore = cookies()
  const supabase = createServerSupabaseClient(cookieStore)

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const [place, reviews] = await Promise.all([
    getPlaceById(supabase as any, params.id),
    getPlaceReviews(supabase as any, { place_id: params.id }),
  ])

  if (!place) redirect("/explore")

  return <PlaceClient place={place} reviews={reviews} userId={user.id} />
}
