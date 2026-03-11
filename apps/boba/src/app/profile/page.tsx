import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { createServerSupabaseClient } from "@niche/auth"
import { getProfile, getUserReviews } from "@niche/database"
import ProfileClient from "./ProfileClient"

export default async function ProfilePage() {
  const cookieStore = cookies()
  const supabase = createServerSupabaseClient(cookieStore)

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const [profile, reviews] = await Promise.all([
    getProfile(supabase as any, user.id),
    getUserReviews(supabase as any, { user_id: user.id, app_id: "boba" }),
  ])

  return <ProfileClient profile={profile} initialReviews={reviews} userId={user.id} />
}
