import { createServerSupabaseClient } from "@niche/auth/server"
import { getCupOfTheDay, getFollowing, getFriendReviewsSince, getProfile, getSuggestedPeople, getUserStats } from "@niche/database"
import AppShell from "@/components/ui/AppShell"
import { CoverStory, Masthead, WeekAmongFriends } from "@/components/home/Cover"
import { Welcome } from "@/components/home/Welcome"
import { APP_ID, sipDate, sipNumber } from "@/lib/boba"

export default async function HomePage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const [profile, stats, following] = await Promise.all([
    getProfile(supabase, user.id),
    getUserStats(supabase, { user_id: user.id, app_id: APP_ID }),
    getFollowing(supabase, user.id),
  ])
  const sip = sipNumber(profile?.created_at)
  const date = sipDate()

  const cup = stats.cups > 0 || following.length > 0
    ? await getCupOfTheDay(supabase, { user_id: user.id, app_id: APP_ID })
    : null

  if (!cup) {
    const people = await getSuggestedPeople(supabase, { user_id: user.id, app_id: APP_ID, limit: 20 }).catch(() => [])
    return (
      <AppShell>
        <Welcome sip={sip} date={date} peopleHere={people.length} />
      </AppShell>
    )
  }

  const week = (await getFriendReviewsSince(supabase, {
    user_id: user.id, app_id: APP_ID, since: new Date(Date.now() - 7 * 86_400_000), limit: 13,
  })).filter(r => r.id !== cup.id).slice(0, 8)

  return (
    <AppShell>
      <Masthead sip={sip} date={date} />
      <CoverStory review={cup} />
      <WeekAmongFriends reviews={week} />
    </AppShell>
  )
}
