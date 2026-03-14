import { createServerSupabaseClient } from "@niche/auth/server"
import LogClient from "./LogClient"

export default async function LogPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  return <LogClient userId={user.id} />
}
