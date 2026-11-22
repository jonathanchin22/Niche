"use server"

import { cookies } from "next/headers"
import { getServerSession } from "@niche/auth/server"
import { acceptInvite, followUser, INVITE_COOKIE, unfollowUser, type InviteResult } from "@niche/database"
import { APP_ID } from "@/lib/brew"

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

/**
 * Accept an invite link as the signed-in user: the code passed in, or the one
 * remembered in a cookie from before they signed in (which is then cleared).
 * Null when there's nothing to claim or the link is no good.
 */
export async function claimInvite(code?: string): Promise<InviteResult | null> {
  const { supabase, user } = await getServerSession()
  if (!user) return null
  const jar = cookies()
  const pending = code ?? jar.get(INVITE_COOKIE)?.value
  if (!pending) return null
  const result = await acceptInvite(supabase, { code: pending, app_id: APP_ID })
  jar.delete(INVITE_COOKIE)
  return result
}
