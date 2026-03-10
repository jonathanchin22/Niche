import { createClient } from "@supabase/supabase-js"
import type {
  AppId, Review, Place, FeedItem, MapPin,
  SearchResult, PaginatedResponse, User
} from "@niche/shared-types"

// ─── Admin client (server-side only, never expose to browser) ─────────────────
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

// ─── Feed queries ─────────────────────────────────────────────────────────────

/**
 * Get the friend feed for a user in a specific app.
 * Returns reviews from people the user follows, most recent first.
 * Cursor-based pagination for infinite scroll.
 */
export async function getFriendFeed(
  supabase: ReturnType<typeof createClient>,
  {
    user_id,
    app_id,
    cursor,
    limit = 20,
  }: { user_id: string; app_id: AppId; cursor?: string; limit?: number }
): Promise<PaginatedResponse<FeedItem>> {
  let query = supabase
    .from("reviews")
    .select(`
      *,
      user:profiles!reviews_user_id_fkey(id, username, display_name, avatar_url),
      place:places!reviews_place_id_fkey(id, name, city, state),
      likes_count:review_likes(count),
      comments_count:review_comments(count),
      user_has_liked:review_likes!inner(user_id)
    `)
    .eq("app_id", app_id)
    .in(
      "user_id",
      supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", user_id)
    )
    .order("created_at", { ascending: false })
    .limit(limit + 1) // fetch one extra to determine has_more

  if (cursor) {
    query = query.lt("created_at", cursor)
  }

  const { data, error } = await query
  if (error) throw error

  const hasMore = data.length > limit
  const items = hasMore ? data.slice(0, limit) : data

  return {
    data: items.map((r) => ({ type: "review", review: r as Review, created_at: r.created_at })),
    cursor: hasMore ? items[items.length - 1]?.created_at ?? null : null,
    has_more: hasMore,
  }
}

// ─── Review queries ───────────────────────────────────────────────────────────

export async function createReview(
  supabase: ReturnType<typeof createClient>,
  review: Omit<Review, "id" | "created_at" | "updated_at">
): Promise<Review> {
  const { data, error } = await supabase
    .from("reviews")
    .insert(review)
    .select()
    .single()

  if (error) throw error
  return data as Review
}

export async function likeReview(
  supabase: ReturnType<typeof createClient>,
  { review_id, user_id }: { review_id: string; user_id: string }
) {
  const { error } = await supabase
    .from("review_likes")
    .upsert({ review_id, user_id }, { onConflict: "review_id,user_id", ignoreDuplicates: true })
  if (error) throw error
}

export async function unlikeReview(
  supabase: ReturnType<typeof createClient>,
  { review_id, user_id }: { review_id: string; user_id: string }
) {
  const { error } = await supabase
    .from("review_likes")
    .delete()
    .eq("review_id", review_id)
    .eq("user_id", user_id)
  if (error) throw error
}

// ─── Place queries ────────────────────────────────────────────────────────────

/**
 * Get places for the map view with friend review counts.
 * Only returns places within the bounding box.
 */
export async function getMapPins(
  supabase: ReturnType<typeof createClient>,
  {
    app_id,
    user_id,
    bounds,
  }: {
    app_id: AppId
    user_id: string
    bounds: { north: number; south: number; east: number; west: number }
  }
): Promise<MapPin[]> {
  const { data, error } = await supabase.rpc("get_map_pins", {
    p_app_id: app_id,
    p_user_id: user_id,
    p_north: bounds.north,
    p_south: bounds.south,
    p_east: bounds.east,
    p_west: bounds.west,
  })

  if (error) throw error
  return data as MapPin[]
}

/**
 * Find or create a place by Google Place ID.
 * Used during the review logging flow.
 */
export async function upsertPlace(
  supabase: ReturnType<typeof createClient>,
  place: Omit<Place, "id" | "avg_score" | "review_count" | "created_at" | "updated_at">
): Promise<Place> {
  const { data, error } = await supabase
    .from("places")
    .upsert(place, { onConflict: "app_id,google_place_id" })
    .select()
    .single()

  if (error) throw error
  return data as Place
}

// ─── Search ───────────────────────────────────────────────────────────────────

/**
 * Full-text search across places, users, and vibe tags.
 * Uses Postgres full-text search via Supabase.
 */
export async function search(
  supabase: ReturnType<typeof createClient>,
  { app_id, query, limit = 10 }: { app_id: AppId; query: string; limit?: number }
): Promise<SearchResult[]> {
  const results: SearchResult[] = []

  // Search places
  const { data: places } = await supabase
    .from("places")
    .select("*")
    .eq("app_id", app_id)
    .textSearch("fts", query, { type: "websearch" })
    .limit(limit)

  if (places) {
    results.push(...places.map((p) => ({ type: "place" as const, place: p as Place })))
  }

  // Search users
  const { data: users } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url")
    .or(`username.ilike.%${query}%,display_name.ilike.%${query}%`)
    .limit(5)

  if (users) {
    results.push(...users.map((u) => ({ type: "user" as const, user: u as User })))
  }

  return results
}

// ─── Social graph ─────────────────────────────────────────────────────────────

export async function followUser(
  supabase: ReturnType<typeof createClient>,
  { follower_id, following_id }: { follower_id: string; following_id: string }
) {
  const { error } = await supabase
    .from("follows")
    .upsert({ follower_id, following_id }, { onConflict: "follower_id,following_id", ignoreDuplicates: true })
  if (error) throw error
}

export async function unfollowUser(
  supabase: ReturnType<typeof createClient>,
  { follower_id, following_id }: { follower_id: string; following_id: string }
) {
  const { error } = await supabase
    .from("follows")
    .delete()
    .eq("follower_id", follower_id)
    .eq("following_id", following_id)
  if (error) throw error
}
