// ─── App IDs ────────────────────────────────────────────────────────────────
// Each niche app has a unique ID. Adding a new app = adding a value here.
export type AppId = "brew" | "boba" | "slice" | "ramen" | "pizza"

// ─── Shared Account / Identity ───────────────────────────────────────────────
// One user account spans all apps. app_memberships tracks which apps they joined.
export interface User {
  id: string
  email: string
  username: string
  display_name: string
  avatar_url: string | null
  bio: string | null
  created_at: string
  // Which apps this user has joined (populated from app_memberships table)
  app_memberships?: AppMembership[]
}

export interface AppMembership {
  user_id: string
  app_id: AppId
  joined_at: string
  // Gamification: XP and badges are per-app
  xp: number
  badges: Badge[]
}

// ─── Social Graph ────────────────────────────────────────────────────────────
// Follows are global — follow once, see your friend across all apps
export interface Follow {
  follower_id: string
  following_id: string
  created_at: string
}

// ─── Places ──────────────────────────────────────────────────────────────────
export interface Place {
  id: string
  app_id: AppId
  name: string
  address: string
  city: string
  state: string
  country: string
  lat: number
  lng: number
  google_place_id: string | null
  foursquare_id: string | null
  cover_image_url: string | null
  // Computed aggregates (from reviews)
  avg_score: number | null
  review_count: number
  created_at: string
  updated_at: string
}

// ─── Social interactions ──────────────────────────────────────────────────────
// Upvote/downvote (vote: 1 = upvote, -1 = downvote)
export interface ReviewVote {
  review_id: string
  user_id: string
  vote: 1 | -1
  created_at: string
}

export interface ReviewComment {
  id: string
  review_id: string
  user_id: string
  body: string
  created_at: string
  user?: Pick<User, "id" | "username" | "avatar_url"> 
  // Optionally, add parent_id for threaded comments in the future
}

// ─── Gamification ─────────────────────────────────────────────────────────────
export type BadgeId =
  | "first_review"     // logged their first review
  | "explorer"         // reviewed 5 different places
  | "century_club"     // 100 reviews
  | "trendsetter"      // first to review a new place
  | "social_butterfly" // 10+ followers
  // App-specific
  | "brew_purist"      // only logs pour overs / filter
  | "boba_royalty"     // reviewed 20+ boba shops
  | "slice_lord"       // reviewed 50+ pizza spots

export interface Badge {
  id: BadgeId
  app_id: AppId
  earned_at: string
}

// ─── Map / Search ─────────────────────────────────────────────────────────────
export interface MapPin {
  place: Place
  friend_count: number       // how many friends have reviewed this
  friend_avatars: string[]   // first 3 friend avatar URLs
  top_score: number | null
}

export interface Review {
  id: string
  app_id: AppId
  user_id: string
  place_id: string
  // Score: 0–10 decimal for brew/slice, 1–5 for boba
  score: number
  // What they ordered (e.g. "pour over", "taro milk tea", "detroit style")
  category: string | null
  item_name: string | null
  // The written note (optional)
  note: string | null
  // Vibes / tags (e.g. "great study spot", "date night")
  tags: string[]
  image_urls: string[]
  created_at: string
  updated_at: string
  // Boba-specific structured data
  taste_attributes?: BobaTasteAttributes | null
  customizations?: string[]
  toppings?: string[]
  quality_signals?: BobaQualitySignals | null
  visit_context?: string | null
  revisit_intent?: boolean | null
  price_paid?: number | null
  // Joined fields (populated by queries)
  user?: Pick<User, "id" | "username" | "display_name" | "avatar_url">
  place?: Pick<Place, "id" | "name" | "city" | "state">
  upvotes_count?: number
  downvotes_count?: number
  user_vote?: 1 | -1 | 0
  comments_count?: number
  // Optionally, top_comment?: ReviewComment
}

export type BobaDrinkType =
  | "milk tea"
  | "fruit tea"
  | "matcha"
  | "taro"
  | "brown sugar"
  | "cheese foam"
  | "yakult"
  | "smoothie"
  | "seasonal special"

export type BobaSugarLevel = 0 | 25 | 50 | 75 | 100

export type BobaIceLevel = "no ice" | "less" | "regular" | "extra"

export type BobaPearlTexture =
  | "perfect chew"
  | "too soft"
  | "too hard"
  | "overcooked"

export type BobaTeaBase = "real tea" | "powdery" | "artificial"

export type BobaTopping =
  | "classic boba"
  | "tiger pearls"
  | "popping boba"
  | "lychee jelly"
  | "grass jelly"
  | "pudding"
  | "red bean"
  | "aloe vera"
  | "coconut jelly"
  | "no topping"

export interface BobaTasteAttributes {
  drink_type: BobaDrinkType
  sugar_level: BobaSugarLevel
  ice_level: BobaIceLevel
  pearl_texture?: BobaPearlTexture | null
  tea_base?: BobaTeaBase | null
}

export interface BobaQualitySignals {
  pearls: number      // 1-5 rating
  tea_base: number    // 1-5 rating
  sweetness_accuracy: number  // 1-5 rating
}

// ─── Feed ─────────────────────────────────────────────────────────────────────
export interface FeedItem {
  type: "review" | "follow" | "badge"
  review?: Review
  follow?: { follower: Pick<User, "id" | "username" | "avatar_url">; following: Pick<User, "id" | "username" | "avatar_url"> }
  badge?: { user: Pick<User, "id" | "username" | "avatar_url">; badge: Badge }
  created_at: string
}

// ─── API response wrappers ────────────────────────────────────────────────────
export interface PaginatedResponse<T> {
  data: T[]
  cursor: string | null
  has_more: boolean
}

export interface SearchResult {
  type: "place" | "user" | "tag"
  place?: Place
  user?: Pick<User, "id" | "username" | "display_name" | "avatar_url">
  tag?: string
}

export interface ApiError {
  code: string
  message: string
  details?: unknown
}
