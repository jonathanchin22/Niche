import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { createServerSupabaseClient } from "@niche/auth"
import FriendsPageClient from "./FriendsClient"

export default async function FriendsPage() {
  const cookieStore = cookies()
  const supabase = createServerSupabaseClient(cookieStore)

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  return <FriendsPageClient userId={user.id} />
}
