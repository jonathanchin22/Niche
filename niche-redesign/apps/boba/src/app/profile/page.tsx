import { createServerSupabaseClient } from "@niche/auth"
import { ProfileClient } from "./ProfileClient"
import { redirect } from "next/navigation"
import { getUserReviews } from "@niche/database"

export default async function ProfilePage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const [profileResult, reviews] = await Promise.all([
    (supabase as any).from("profiles").select("*").eq("id", user.id).single(),
    getUserReviews(supabase as any, { user_id: user.id, app_id: "boba" }).catch(() => []),
  ])

  const profile = profileResult?.data ?? null

  return <ProfileClient userId={user.id} profile={profile} reviews={reviews as any[]} />
}
