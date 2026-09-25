import { getServerSession } from "@niche/auth/server"
import { getHomeFeed, getProfile, getSuggestedPeople } from "@niche/database"
import AppShell from "@/components/ui/AppShell"
import { Community, CoverStory, Feed, Masthead } from "@/components/home/Cover"
import { Welcome } from "@/components/home/Welcome"
import { APP_ID, issueDate, issueNumber } from "@/lib/brew"

export default async function HomePage() {
  const { supabase, user } = await getServerSession()
  if (!user) return null

  const [profile, feed] = await Promise.all([
    getProfile(supabase, user.id),
    getHomeFeed(supabase, { user_id: user.id, app_id: APP_ID }),
  ])
  const issue = issueNumber(profile?.created_at)
  const date = issueDate()

  // The welcome page is for first opens only: no cups of your own and none
  // from anyone you follow. Everyone else gets the feed.
  if (!feed.cover) {
    const people = await getSuggestedPeople(supabase, { user_id: user.id, app_id: APP_ID, limit: 20 }).catch(() => [])
    return (
      <AppShell>
        <Welcome issue={issue} date={date} peopleHere={people.length} />
        <Community reviews={feed.community} viewerId={user.id} first />
      </AppShell>
    )
  }

  return (
    <AppShell>
      <Masthead issue={issue} date={date} />
      <CoverStory review={feed.cover} when={feed.coverWhen} />
      <Feed reviews={feed.entries} />
      <Community reviews={feed.community.slice(0, feed.entries.length >= 12 ? 4 : 12)} viewerId={user.id} />
    </AppShell>
  )
}
