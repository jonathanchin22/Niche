import { redirect } from "next/navigation"
import { createServerSupabaseClient } from "@niche/auth"
import { getPlaceSaves } from "@niche/database"
import { CollectionsClient } from "./CollectionsClient"

export default async function CollectionsPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect("/auth/login")

  const [favorites, wantToTry] = await Promise.all([
    getPlaceSaves(supabase as any, { user_id: user.id, app_id: "boba", list_type: "favorites" }).catch(() => []),
    getPlaceSaves(supabase as any, { user_id: user.id, app_id: "boba", list_type: "want_to_try" }).catch(() => []),
  ])

  return <CollectionsClient favorites={favorites as any[]} wantToTry={wantToTry as any[]} />
}
