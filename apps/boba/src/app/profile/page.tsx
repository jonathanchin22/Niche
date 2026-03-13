import { createServerSupabaseClient } from "@niche/auth"
import { ProfileClient } from "./ProfileClient"
import { redirect } from "next/navigation"
import { getUserProfile, getUserReviews } from "@niche/database"

export default async function ProfilePage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const [profile, reviews] = await Promise.all([
    getUserProfile(supabase as any, { user_id: user.id }).catch(() => null),
    getUserReviews(supabase as any, { user_id: user.id, app_id: "boba" }).catch(() => []),
  ])

  return <ProfileClient userId={user.id} profile={profile} reviews={reviews as any[]} />
}
