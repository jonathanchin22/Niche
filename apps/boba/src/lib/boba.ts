import { formatDistanceToNowStrict } from "date-fns"
import type { BobaIceLevel, BobaSugarLevel, BobaTasteAttributes, Place, Review, User } from "@niche/shared-types"

export const APP_ID = "boba" as const

/** Tea made at home shares one place row per app (see ReviewForm). */
export const HOME_PLACE_ID = "boba_home"

export const SUGAR_LEVELS: BobaSugarLevel[] = [0, 25, 50, 75, 100]
export const ICE_LEVELS: BobaIceLevel[] = ["no ice", "less", "regular", "extra"]
export const TOPPINGS = [
  "classic boba", "tiger pearls", "popping boba", "lychee jelly", "grass jelly",
  "pudding", "red bean", "cheese foam", "no topping",
] as const

export function isHomePlace(place: { google_place_id?: string | null } | null | undefined) {
  return place?.google_place_id === HOME_PLACE_ID
}

export function placeLabel(place: { name?: string | null; city?: string | null; google_place_id?: string | null } | null | undefined) {
  if (!place) return ""
  if (isHomePlace(place)) return "made at home"
  return [place.name, place.city].filter(Boolean).join(", ")
}

export function formatScore(score: number | string | null | undefined) {
  const n = Number(score)
  return Number.isFinite(n) ? n.toFixed(1) : "–"
}

export function iceLabel(ice: string) {
  return ice === "less" ? "less ice" : ice === "extra" ? "extra ice" : ice === "regular" ? "regular ice" : ice
}

/** "50% sugar", "less ice", toppings — the order someone would say it at the counter. */
export function tasteChips(review: { taste_attributes?: Partial<BobaTasteAttributes> | null; toppings?: string[] | null }) {
  const chips: string[] = []
  const ta = review.taste_attributes
  if (ta?.sugar_level != null) chips.push(`${ta.sugar_level}% sugar`)
  if (ta?.ice_level) chips.push(iceLabel(ta.ice_level))
  for (const t of review.toppings ?? []) if (t !== "no topping") chips.push(t)
  return chips
}

/** Drink family from the name — stored as category and taste_attributes.drink_type. */
const DRINK_TYPES: [RegExp, BobaTasteAttributes["drink_type"]][] = [
  [/brown sugar|tiger/, "brown sugar"],
  [/matcha/, "matcha"],
  [/taro|ube/, "taro"],
  [/cheese|foam/, "cheese foam"],
  [/yakult|yogurt/, "yakult"],
  [/smoothie|slush|frappe/, "smoothie"],
  [/fruit|mango|lychee|passion|peach|strawberry|lemon|grapefruit|jasmine green/, "fruit tea"],
  [/milk|thai|oolong|hokkaido|okinawa|assam|black tea/, "milk tea"],
]

export function inferDrinkType(name: string): BobaTasteAttributes["drink_type"] | null {
  const text = name.toLowerCase()
  return DRINK_TYPES.find(([re]) => re.test(text))?.[1] ?? null
}

export function timeAgo(date: string) {
  if (Date.now() - new Date(date).getTime() < 60_000) return "just now"
  return formatDistanceToNowStrict(new Date(date), { addSuffix: false })
    .replace(/ seconds?/, "s").replace(/ minutes?/, "m").replace(/ hours?/, "h")
    .replace(/ days?/, "d").replace(/ months?/, "mo").replace(/ years?/, "y") + " ago"
}

/** Home is a daily "sip": no. 1 on the day you joined, counting up. */
export function sipNumber(joinedAt: string | null | undefined, now = new Date()) {
  if (!joinedAt) return 1
  const days = Math.floor((now.getTime() - new Date(joinedAt).getTime()) / 86_400_000)
  return Math.max(1, days + 1)
}

export function sipDate(now = new Date()) {
  return now.toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short" }).toLowerCase().replace(",", "")
}

// ─── Shapes the boba screens read ─────────────────────────────────────────────
// The shared database package returns loosely-typed rows; these describe what
// its queries actually select (see REVIEW_CARD_SELECT in @niche/database).

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

export type Profile = Person & { bio?: string | null; created_at?: string }

export type SearchPlace = Place
