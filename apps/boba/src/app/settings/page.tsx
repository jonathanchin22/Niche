import { getServerSession } from "@niche/auth/server"
import { getBlockedUsers } from "@niche/database"
import AppShell from "@/components/ui/AppShell"
import BackButton from "@/components/ui/BackButton"
import { PageTitle } from "@/components/ui/Primitives"
import SettingsClient from "./SettingsClient"

export default async function SettingsPage() {
  const { supabase, user } = await getServerSession()
  if (!user) return null

  const blocked = await getBlockedUsers(supabase, user.id).catch(() => [])

  return (
    <AppShell nav={false}>
      <div style={{ position: "relative" }}>
        <div style={{ position: "absolute", top: 12, left: 16 }}><BackButton fallback="/profile" /></div>
      </div>
      <PageTitle>settings</PageTitle>
      <SettingsClient userId={user.id} email={user.email} blocked={blocked} />
    </AppShell>
  )
}
