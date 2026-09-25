import { getServerSession } from "@niche/auth/server"
import { getHomeFeed, getProfile, getSuggestedPeople } from "@niche/database"
import AppShell from "@/components/ui/AppShell"
import { CoverStory, Feed, Masthead } from "@/components/home/Cover"
import { Welcome } from "@/components/home/Welcome"
import { APP_ID, sipDate, sipNumber } from "@/lib/boba"

export default async function HomePage() {
  const { supabase, user } = await getServerSession()
  if (!user) return null

  const [profile, feed] = await Promise.all([
    getProfile(supabase, user.id),
    getHomeFeed(supabase, { user_id: user.id, app_id: APP_ID }),
  ])
  const sip = sipNumber(profile?.created_at)
  const date = sipDate()

  // The welcome page is for first opens only: no sips of your own and none
  // from anyone you follow. Everyone else gets the feed.
  if (!feed.cover) {
    const people = await getSuggestedPeople(supabase, { user_id: user.id, app_id: APP_ID, limit: 20 }).catch(() => [])
    return (
      <AppShell>
        <Welcome sip={sip} date={date} peopleHere={people.length} />
      </AppShell>
    )
  }

  return (
    <AppShell>
      <Masthead sip={sip} date={date} />
      <CoverStory review={feed.cover} when={feed.coverWhen} />
      <Feed reviews={feed.entries} />
    </AppShell>
  )
}
