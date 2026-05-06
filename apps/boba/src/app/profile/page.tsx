import { createServerSupabaseClient } from "@niche/auth"
import { ProfileClient } from "./ProfileClient"
import { redirect } from "next/navigation"
import { getUserReviews } from "@niche/database"
import { APP_ID } from "@/lib/app-id"

export default async function ProfilePage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const [profileResult, reviewsResult] = await Promise.all([
    (supabase as any).from("profiles").select("*").eq("id", user.id).single(),
    getUserReviews(supabase, { user_id: user.id, app_id: APP_ID }).catch(() => ({ data: [] })),
  ])

  const profile = profileResult?.data ?? null
  const reviews = reviewsResult.data.map((item: any) => item.review)

  return <ProfileClient userId={user.id} profile={profile} reviews={reviews} />
}
