import { redirect } from "next/navigation"
import { createServerSupabaseClient } from "@niche/auth"
import { getNotifications } from "@niche/database"
import { NotificationsClient } from "./NotificationsClient"

export default async function NotificationsPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect("/auth/login")

  const initialNotifications = await getNotifications(supabase as any, {
    user_id: user.id,
    limit: 50,
  }).catch(() => [])

  return <NotificationsClient userId={user.id} initialNotifications={initialNotifications as any[]} />
}
