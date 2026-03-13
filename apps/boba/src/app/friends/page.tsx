import { createServerSupabaseClient } from "@niche/auth"
import { FriendsClient } from "./FriendsClient"
import { redirect } from "next/navigation"

export default async function FriendsPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  return <FriendsClient userId={user.id} />
}
