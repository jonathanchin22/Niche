import { redirect } from "next/navigation"
import { createServerSupabaseClient } from "@niche/auth"
import { getTopPlaces, getTopReviewers } from "@niche/database"
import { LeaderboardsClient } from "./LeaderboardsClient"

export default async function LeaderboardsPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect("/auth/login")

  const [topPlaces, topReviewers] = await Promise.all([
    getTopPlaces(supabase as any, { app_id: "boba", limit: 25 }).catch(() => []),
    getTopReviewers(supabase as any, { app_id: "boba", limit: 25 }).catch(() => []),
  ])

  return <LeaderboardsClient topPlaces={topPlaces as any[]} topReviewers={topReviewers as any[]} />
}
