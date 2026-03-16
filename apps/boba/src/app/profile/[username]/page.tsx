import { createServerSupabaseClient } from "@niche/auth"
import { getUserReviews } from "@niche/database"
import { redirect, notFound } from "next/navigation"
import { ProfileClient } from "../ProfileClient"

interface ProfileByUsernamePageProps {
  params: { username: string }
}

export default async function ProfileByUsernamePage({ params }: ProfileByUsernamePageProps) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const username = decodeURIComponent(params.username)
  const { data: profile } = await (supabase as any)
    .from("profiles")
    .select("*")
    .eq("username", username)
    .maybeSingle()

  if (!profile) notFound()

  const reviewsResult = await getUserReviews(supabase as any, {
    user_id: profile.id,
    app_id: "boba",
  }).catch(() => ({ data: [] }))

  const reviews = reviewsResult.data.map((item: any) => item.review)

  return (
    <ProfileClient
      userId={user.id}
      profile={profile}
      reviews={reviews}
      showSignOut={user.id === profile.id}
      showBackButton={user.id !== profile.id}
    />
  )
}
