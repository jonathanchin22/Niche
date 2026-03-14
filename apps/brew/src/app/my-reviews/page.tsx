import { createServerSupabaseClient } from "@niche/auth/server"
import AppShell from "@/components/ui/AppShell"
import MyReviewsClient from "./MyReviewsClient"

export default async function MyReviewsPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  return (
    <AppShell>
      <div>
        <div style={{ padding: "52px 28px 20px" }}>
          <h1 style={{
            fontFamily: "var(--font-display)", fontSize: 36, color: "var(--c-ink)",
            margin: "0 0 4px", fontWeight: 400, fontStyle: "italic",
          }}>
            my drinks
          </h1>
          <p style={{ fontFamily: "var(--font-hand)", fontSize: 15, color: "var(--c-subtle)", margin: 0 }}>
            every cup, remembered
          </p>
        </div>
        <MyReviewsClient userId={user.id} />
      </div>
    </AppShell>
  )
}
