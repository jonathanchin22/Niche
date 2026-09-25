import { formatDistanceToNowStrict } from "date-fns"

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
