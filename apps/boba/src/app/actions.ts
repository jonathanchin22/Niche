"use server"

import { getServerSession } from "@niche/auth/server"
import { followUser, unfollowUser } from "@niche/database"

/**
 * Follow or unfollow as the signed-in user. A server action, so buttons that
 * use it don't ship the Supabase client to the browser.
 */
export async function setFollowing(targetId: string, follow: boolean): Promise<void> {
  const { supabase, user } = await getServerSession()
  if (!user) throw new Error("Not signed in")
  if (follow) await followUser(supabase, { follower_id: user.id, following_id: targetId })
  else await unfollowUser(supabase, { follower_id: user.id, following_id: targetId })
}
