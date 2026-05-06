import { createServerSupabaseClient } from "@niche/auth"
import { redirect } from "next/navigation"
import { getUserReviews } from "@niche/database"
import { MyReviewsClient } from "./MyReviewsClient"
import { APP_ID } from "@/lib/app-id"

export default async function MyReviewsPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const reviewsResult = await getUserReviews(supabase, {
    user_id: user.id,
    app_id: APP_ID,
  }).catch(() => ({ data: [] }))

  const reviews = reviewsResult.data.map((item: any) => item.review)

  return <MyReviewsClient userId={user.id} initialReviews={reviews as any[]} />
}
