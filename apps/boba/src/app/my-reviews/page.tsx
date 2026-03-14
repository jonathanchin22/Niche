import { createServerSupabaseClient } from "@niche/auth"
import { redirect } from "next/navigation"
import { getUserReviews } from "@niche/database"
import { MyReviewsClient } from "./MyReviewsClient"

export default async function MyReviewsPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const reviewsResult = await getUserReviews(supabase as any, {
    user_id: user.id,
    app_id: "boba",
  }).catch(() => ({ data: [] }))

  const reviews = reviewsResult.data

  return <MyReviewsClient userId={user.id} initialReviews={reviews as any[]} />
}
