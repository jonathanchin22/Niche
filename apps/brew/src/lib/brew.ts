import { formatDistanceToNowStrict } from "date-fns"
import type { Place, Review, User } from "@niche/shared-types"

export const APP_ID = "brew" as const

/** Home-brew logs share one place row per app (see ReviewForm). */
export const HOME_PLACE_ID = "brew_home"

export function isHomePlace(place: { google_place_id?: string | null } | null | undefined) {
  return place?.google_place_id === HOME_PLACE_ID
}

export function placeLabel(place: { name?: string | null; city?: string | null; google_place_id?: string | null } | null | undefined) {
  if (!place) return ""
  if (isHomePlace(place)) return "at home"
  return [place.name, place.city].filter(Boolean).join(", ")
}

export function formatScore(score: number | string | null | undefined) {
  const n = Number(score)
  return Number.isFinite(n) ? n.toFixed(1) : "–"
}

/** "2h ago", "3d ago" — short, for meta lines. */
export function timeAgo(date: string) {
  if (Date.now() - new Date(date).getTime() < 60_000) return "just now"
  return formatDistanceToNowStrict(new Date(date), { addSuffix: false })
    .replace(/ seconds?/, "s").replace(/ minutes?/, "m").replace(/ hours?/, "h")
    .replace(/ days?/, "d").replace(/ months?/, "mo").replace(/ years?/, "y") + " ago"
}

/** The home screen is an "issue": no. 1 on the day you joined, counting up daily. */
export function issueNumber(joinedAt: string | null | undefined, now = new Date()) {
  if (!joinedAt) return 1
  const days = Math.floor((now.getTime() - new Date(joinedAt).getTime()) / 86_400_000)
  return Math.max(1, days + 1)
}

export function issueDate(now = new Date()) {
  return now.toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short" }).toLowerCase().replace(",", "")
}

// ─── Shapes the brew screens read ─────────────────────────────────────────────
// The shared database package returns loosely-typed rows; these describe what
// its brew queries actually select (see REVIEW_CARD_SELECT in @niche/database).
export type Person = Pick<User, "id" | "username" | "display_name" | "avatar_url">

export interface CupPlace {
  id: string
  name: string
  city?: string | null
  state?: string | null
  cover_image_url?: string | null
  google_place_id?: string | null
  lat?: number | null
  lng?: number | null
}

export type Cup = Omit<Review, "user" | "place"> & {
  user?: Person | null
  profile?: Person | null
  place?: CupPlace | null
}

export interface CupComment {
  id: string
  body: string
  created_at: string
  user_id: string
  user?: Person | null
}

export type Profile = Person & { bio?: string | null; created_at?: string; location?: string | null }
