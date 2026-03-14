import { createServerSupabaseClient } from "@niche/auth/server"
import AppShell from "@/components/ui/AppShell"
import FriendsClient from "./FriendsClient"

export default async function FriendsPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  return (
    <AppShell>
      <div>
        <div style={{ padding: "52px 28px 0" }}>
          <h1 style={{
            fontFamily: "var(--font-display)", fontSize: 36, color: "var(--c-ink)",
            margin: "0 0 4px", fontWeight: 400, fontStyle: "italic",
          }}>
            friends
          </h1>
          <p style={{ fontFamily: "var(--font-hand)", fontSize: 15, color: "var(--c-subtle)", margin: 0 }}>
            what they&apos;ve been brewing
          </p>
        </div>
        <FriendsClient userId={user.id} />
      </div>
    </AppShell>
  )
}
