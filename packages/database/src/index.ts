import type { AppId, FeedItem, Place, PaginatedResponse, Review, MapPin, SearchResult } from "@niche/shared-types"

type SupabaseClient = any

interface FeedParams {
  user_id: string
  app_id: AppId
  cursor?: string
  limit?: number
}

interface MapBoundsParams {
  app_id: AppId
  user_id: string
  bounds: { north: number; south: number; east: number; west: number }
}

interface SearchParams {
  app_id: AppId
  query: string
  user_id: string
}

// ─── Feed ────────────────────────────────────────────────────────────────────

export async function getFriendFeed(
  supabase: SupabaseClient,
  { user_id, app_id, cursor, limit = 20 }: FeedParams
): Promise<PaginatedResponse<FeedItem>> {
  // Step 1: get following IDs first
  const { data: follows } = await supabase
    .from("follows")
    .select("following_id")
    .eq("follower_id", user_id)

  const followingIds = (follows ?? []).map((f: any) => f.following_id)
  followingIds.push(user_id) // include own reviews

  // Step 2: fetch reviews from those users
  let query = supabase
    .from("reviews")
    .select(`*`)
    .eq("app_id", app_id)
    .in("user_id", followingIds.length > 0 ? followingIds : [""])
    .order("created_at", { ascending: false })
    .limit(limit)

  if (cursor) query = query.lt("created_at", cursor)

  const { data, error } = await query
  if (error) throw error

  const items = (data ?? []).map((r: any) => ({ review: r }))
  const nextCursor = data?.length === limit ? data[data.length - 1].created_at : undefined

  return { data: items, cursor: nextCursor, has_more: !!nextCursor }
}

// ─── Reviews ─────────────────────────────────────────────────────────────────

export async function createReview(
  supabase: SupabaseClient,
  review: Omit<Review, "id" | "created_at" | "updated_at">
): Promise<Review> {
  const { data, error } = await (supabase as any)
    .from("reviews")
    .insert(review)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function likeReview(
  supabase: SupabaseClient,
  { review_id, user_id }: { review_id: string; user_id: string }
): Promise<void> {
  const { error } = await (supabase as any)
    .from("review_likes")
    .upsert({ review_id, user_id }, { onConflict: "review_id,user_id", ignoreDuplicates: true })
  if (error) throw error
}

export async function unlikeReview(
  supabase: SupabaseClient,
  { review_id, user_id }: { review_id: string; user_id: string }
): Promise<void> {
  const { error } = await (supabase as any)
    .from("review_likes")
    .delete()
    .eq("review_id", review_id)
    .eq("user_id", user_id)
  if (error) throw error
}

// ─── Map ─────────────────────────────────────────────────────────────────────

export async function getMapPins(
  supabase: SupabaseClient,
  { app_id, user_id, bounds }: MapBoundsParams
): Promise<MapPin[]> {
  const { data, error } = await (supabase as any).rpc("get_map_pins", {
    p_app_id: app_id,
    p_user_id: user_id,
    p_north: bounds.north,
    p_south: bounds.south,
    p_east: bounds.east,
    p_west: bounds.west,
  })
  if (error) throw error
  return data ?? []
}

// ─── Places ──────────────────────────────────────────────────────────────────

export async function upsertPlace(
  supabase: SupabaseClient,
  place: Omit<Place, "id" | "created_at" | "avg_score" | "review_count" | "updated_at">
): Promise<Place> {
  const { data, error } = await (supabase as any)
    .from("places")
    .upsert(place, { onConflict: "app_id,google_place_id" })
    .select()
    .single()
  if (error) throw error
  return data
}

// ─── Search ──────────────────────────────────────────────────────────────────

export async function search(
  supabase: SupabaseClient,
  { app_id, query, user_id }: SearchParams
): Promise<SearchResult[]> {
  const { data, error } = await (supabase as any)
    .from("places")
    .select("*")
    .eq("app_id", app_id)
    .textSearch("name", query, { type: "websearch" })
    .limit(20)
  if (error) throw error
  return (data ?? []).map((p: any) => ({ type: "place" as const, place: p }))
}

// ─── Social ──────────────────────────────────────────────────────────────────

export async function followUser(
  supabase: SupabaseClient,
  { follower_id, following_id }: { follower_id: string; following_id: string }
): Promise<void> {
  const { error } = await (supabase as any)
    .from("follows")
    .upsert({ follower_id, following_id }, { onConflict: "follower_id,following_id", ignoreDuplicates: true })
  if (error) throw error
}

export async function unfollowUser(
  supabase: SupabaseClient,
  { follower_id, following_id }: { follower_id: string; following_id: string }
): Promise<void> {
  const { error } = await (supabase as any)
    .from("follows")
    .delete()
    .eq("follower_id", follower_id)
    .eq("following_id", following_id)
  if (error) throw error
}