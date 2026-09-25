import type { SupabaseClient } from "@supabase/supabase-js"
import type { AppId } from "@niche/shared-types"

/** Badges for being the first to review a place, in order. */
export interface FirstBadge { at: number; name: string }

export const FIRST_BADGES: FirstBadge[] = [
  { at: 1, name: "pioneer" },
  { at: 3, name: "scout" },
  { at: 10, name: "trailblazer" },
  { at: 25, name: "cartographer" },
  { at: 50, name: "legend" },
]

export interface FirstProgress {
  count: number
  earned: FirstBadge[]
  next: FirstBadge | null
  /** Firsts still needed for the next badge (0 once every badge is earned). */
  toNext: number
}

export function firstProgress(count: number): FirstProgress {
  const earned = FIRST_BADGES.filter(b => count >= b.at)
  const next = FIRST_BADGES.find(b => count < b.at) ?? null
  return { count, earned, next, toNext: next ? next.at - count : 0 }
}

/** How many places this person was the first to review (migration 013). */
export async function getFirstReviewCount(
  supabase: SupabaseClient,
  { user_id, app_id }: { user_id: string; app_id: AppId }
): Promise<number> {
  const { data, error } = await supabase.rpc("first_review_count", { p_user_id: user_id, p_app_id: app_id })
  if (error) throw error
  return typeof data === "number" ? data : 0
}
