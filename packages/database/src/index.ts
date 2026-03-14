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
  // Step 1: get following IDs
  const { data: follows } = await supabase
    .from("follows")
    .select("following_id")
    .eq("follower_id", user_id)

  const followingIds: string[] = (follows ?? []).map((f: any) => f.following_id)

  // Step 2: fetch reviews with related data
  let query = supabase
    .from("reviews")
    .select(`
      id, app_id, user_id, place_id, score, body, image_urls, tags, created_at, updated_at,
      profile:profiles!reviews_user_id_fkey(id, username, display_name, avatar_url),
      place:places!reviews_place_id_fkey(id, name, address, app_id),
      likes:review_likes(count)
    `)
    .eq("app_id", app_id)
    .in("user_id", followingIds.length > 0 ? followingIds : ["00000000-0000-0000-0000-000000000000"])
    .order("created_at", { ascending: false })
    .limit(limit)

  if (cursor) query = query.lt("created_at", cursor)

  const { data, error } = await query
  if (error) {
    console.error("getFriendFeed error:", error)
    // Fallback to simple query if joins fail
    let fallback = supabase
      .from("reviews")
      .select("*")
      .eq("app_id", app_id)
      .in("user_id", followingIds.length > 0 ? followingIds : ["00000000-0000-0000-0000-000000000000"])
      .order("created_at", { ascending: false })
      .limit(limit)
    if (cursor) fallback = fallback.lt("created_at", cursor)
    const { data: fallbackData, error: fallbackError } = await fallback
    if (fallbackError) throw fallbackError
    const items = (fallbackData ?? []).map((r: any) => ({ review: r }))
    const nextCursor = fallbackData?.length === limit ? fallbackData[fallbackData.length - 1]?.created_at : undefined
    return { data: items, cursor: nextCursor, has_more: !!nextCursor }
  }

  const items = (data ?? []).map((r: any) => ({ review: r }))
  const nextCursor = data?.length === limit ? data[data.length - 1]?.created_at : undefined
  return { data: items, cursor: nextCursor, has_more: !!nextCursor }
}

// My Feed - includes user's own reviews + friends' reviews
export async function getMyFeed(
  supabase: SupabaseClient,
  { user_id, app_id, cursor, limit = 20 }: FeedParams
): Promise<PaginatedResponse<FeedItem>> {
  // Step 1: get following IDs
  const { data: follows } = await supabase
    .from("follows")
    .select("following_id")
    .eq("follower_id", user_id)

  const followingIds: string[] = (follows ?? []).map((f: any) => f.following_id)
  followingIds.push(user_id) // Include user's own reviews

  // Step 2: fetch reviews with related data
  let query = supabase
    .from("reviews")
    .select(`
      id, app_id, user_id, place_id, score, body, image_urls, tags, created_at, updated_at,
      profile:profiles!reviews_user_id_fkey(id, username, display_name, avatar_url),
      place:places!reviews_place_id_fkey(id, name, address, app_id),
      likes:review_likes(count)
    `)
    .eq("app_id", app_id)
    .in("user_id", followingIds.length > 0 ? followingIds : ["00000000-0000-0000-0000-000000000000"])
    .order("created_at", { ascending: false })
    .limit(limit)

  if (cursor) query = query.lt("created_at", cursor)

  const { data, error } = await query
  if (error) {
    console.error("getMyFeed error:", error)
    // Fallback to simple query if joins fail
    let fallback = supabase
      .from("reviews")
      .select("*")
      .eq("app_id", app_id)
      .in("user_id", followingIds.length > 0 ? followingIds : ["00000000-0000-0000-0000-000000000000"])
      .order("created_at", { ascending: false })
      .limit(limit)
    if (cursor) fallback = fallback.lt("created_at", cursor)
    const { data: fallbackData, error: fallbackError } = await fallback
    if (fallbackError) throw fallbackError
    const items = (fallbackData ?? []).map((r: any) => ({ review: r }))
    const nextCursor = fallbackData?.length === limit ? fallbackData[fallbackData.length - 1]?.created_at : undefined
    return { data: items, cursor: nextCursor, has_more: !!nextCursor }
  }

  const items = (data ?? []).map((r: any) => ({ review: r }))
  const nextCursor = data?.length === limit ? data[data.length - 1]?.created_at : undefined
  return { data: items, cursor: nextCursor, has_more: !!nextCursor }
}

// ─── Reviews ─────────────────────────────────────────────────────────────────

export async function createReview(
  supabase: SupabaseClient,
  review: Omit<Review, "id" | "created_at" | "updated_at">
): Promise<Review> {
  const { data, error } = await supabase
    .from("reviews")
    .insert(review)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function getReviewById(
  supabase: SupabaseClient,
  review_id: string
): Promise<Review | null> {
  const { data, error } = await supabase
    .from("reviews")
    .select(`
      *,
      profile:profiles!reviews_user_id_fkey(*),
      place:places!reviews_place_id_fkey(*),
      likes:review_likes(count),
      comments:review_comments(*, profile:profiles!review_comments_user_id_fkey(*))
    `)
    .eq("id", review_id)
    .single()
  if (error) return null
  return data
}

export async function getUserReviews(
  supabase: SupabaseClient,
  { user_id, app_id, cursor, limit = 20 }: FeedParams
): Promise<PaginatedResponse<FeedItem>> {
  let query = supabase
    .from("reviews")
    .select(`
      *,
      profile:profiles!reviews_user_id_fkey(*),
      place:places!reviews_place_id_fkey(*),
      likes:review_likes(count)
    `)
    .eq("app_id", app_id)
    .eq("user_id", user_id)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (cursor) query = query.lt("created_at", cursor)

  const { data, error } = await query
  if (error) throw error

  const items = (data ?? []).map((r: any) => ({ review: r }))
  const nextCursor = data?.length === limit ? data[data.length - 1]?.created_at : undefined
  return { data: items, cursor: nextCursor, has_more: !!nextCursor }
}

export async function updateReviewScore(
  supabase: SupabaseClient,
  { review_id, score }: { review_id: string; score: number }
): Promise<void> {
  const { error } = await supabase
    .from("reviews")
    .update({ score, updated_at: new Date().toISOString() })
    .eq("id", review_id)
  if (error) throw error
}

export async function likeReview(
  supabase: SupabaseClient,
  { review_id, user_id }: { review_id: string; user_id: string }
): Promise<void> {
  const { error } = await supabase
    .from("review_likes")
    .upsert({ review_id, user_id }, { onConflict: "review_id,user_id", ignoreDuplicates: true })
  if (error) throw error
}

export async function unlikeReview(
  supabase: SupabaseClient,
  { review_id, user_id }: { review_id: string; user_id: string }
): Promise<void> {
  const { error } = await supabase
    .from("review_likes")
    .delete()
    .eq("review_id", review_id)
    .eq("user_id", user_id)
  if (error) throw error
}

export async function isReviewLiked(
  supabase: SupabaseClient,
  { review_id, user_id }: { review_id: string; user_id: string }
): Promise<boolean> {
  const { data } = await supabase
    .from("review_likes")
    .select("id")
    .eq("review_id", review_id)
    .eq("user_id", user_id)
    .maybeSingle()
  return !!data
}

export async function updateReview(
  supabase: SupabaseClient,
  { review_id, updates }: {
    review_id: string
    updates: { item_name?: string | null; score?: number; body?: string | null; tags?: string[]; image_urls?: string[] }
  }
) {
  const { data, error } = await supabase
    .from("reviews")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", review_id)
    .select()
    .single()
  if (error) throw error
  return data
}

// ─── Map ─────────────────────────────────────────────────────────────────────

export async function getMapPins(
  supabase: SupabaseClient,
  { app_id, user_id, bounds }: MapBoundsParams
): Promise<MapPin[]> {
  // Try RPC first, fall back to direct query
  const { data: rpcData, error: rpcError } = await supabase.rpc("get_map_pins", {
    p_app_id: app_id,
    p_user_id: user_id,
    p_north: bounds.north,
    p_south: bounds.south,
    p_east: bounds.east,
    p_west: bounds.west,
  })

  if (!rpcError && rpcData) return rpcData

  // Fallback: simple place query within bounds
  const { data, error } = await supabase
    .from("places")
    .select("id, name, latitude, longitude, avg_score, review_count")
    .eq("app_id", app_id)
    .gte("latitude", bounds.south)
    .lte("latitude", bounds.north)
    .gte("longitude", bounds.west)
    .lte("longitude", bounds.east)
    .limit(50)

  if (error) throw error
  return (data ?? []).map((p: any) => ({
    place_id: p.id,
    name: p.name,
    latitude: p.latitude,
    longitude: p.longitude,
    avg_score: p.avg_score,
    review_count: p.review_count,
    user_reviewed: false,
    friend_reviewed: false,
  }))
}

// ─── Places ──────────────────────────────────────────────────────────────────

export async function upsertPlace(
  supabase: SupabaseClient,
  place: Omit<Place, "id" | "created_at" | "avg_score" | "review_count" | "updated_at">
): Promise<Place> {
  const { data, error } = await supabase
    .from("places")
    .upsert(place, { onConflict: "app_id,google_place_id" })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function getPlaceById(
  supabase: SupabaseClient,
  place_id: string
): Promise<Place | null> {
  const { data, error } = await supabase
    .from("places")
    .select("*")
    .eq("id", place_id)
    .single()
  if (error) return null
  return data
}

export async function getPlaceReviews(
  supabase: SupabaseClient,
  { place_id, limit = 10 }: { place_id: string; limit?: number }
): Promise<FeedItem[]> {
  const { data, error } = await supabase
    .from("reviews")
    .select(`
      *,
      profile:profiles!reviews_user_id_fkey(*),
      likes:review_likes(count)
    `)
    .eq("place_id", place_id)
    .order("created_at", { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []).map((r: any) => ({ review: r }))
}

// ─── Search ──────────────────────────────────────────────────────────────────

export async function searchPlaces(
  supabase: SupabaseClient,
  { app_id, query }: { app_id: AppId; query: string }
): Promise<Place[]> {
  const { data, error } = await supabase
    .from("places")
    .select("*")
    .eq("app_id", app_id)
    .ilike("name", `%${query}%`)
    .order("review_count", { ascending: false })
    .limit(20)
  if (error) throw error
  return data ?? []
}

export async function searchUsers(
  supabase: SupabaseClient,
  { query, current_user_id }: { query: string; current_user_id: string }
): Promise<any[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url")
    .or(`username.ilike.%${query}%,display_name.ilike.%${query}%`)
    .neq("id", current_user_id)
    .limit(20)
  if (error) throw error
  return data ?? []
}

export async function search(
  supabase: SupabaseClient,
  { app_id, query, user_id }: SearchParams
): Promise<SearchResult[]> {
  const [places, users] = await Promise.all([
    searchPlaces(supabase, { app_id, query }),
    searchUsers(supabase, { query, current_user_id: user_id }),
  ])

  const placeResults: SearchResult[] = places.map((p: any) => ({ type: "place" as const, place: p }))
  const userResults: SearchResult[] = users.map((u: any) => ({ type: "user" as const, user: u }))
  return [...placeResults, ...userResults]
}

// ─── Social ──────────────────────────────────────────────────────────────────

export async function followUser(
  supabase: SupabaseClient,
  { follower_id, following_id }: { follower_id: string; following_id: string }
): Promise<void> {
  const { error } = await supabase
    .from("follows")
    .upsert({ follower_id, following_id }, { onConflict: "follower_id,following_id", ignoreDuplicates: true })
  if (error) throw error
}

export async function unfollowUser(
  supabase: SupabaseClient,
  { follower_id, following_id }: { follower_id: string; following_id: string }
): Promise<void> {
  const { error } = await supabase
    .from("follows")
    .delete()
    .eq("follower_id", follower_id)
    .eq("following_id", following_id)
  if (error) throw error
}

export async function isFollowing(
  supabase: SupabaseClient,
  { follower_id, following_id }: { follower_id: string; following_id: string }
): Promise<boolean> {
  const { data } = await supabase
    .from("follows")
    .select("follower_id")
    .eq("follower_id", follower_id)
    .eq("following_id", following_id)
    .maybeSingle()
  return !!data
}

export async function getFollowers(
  supabase: SupabaseClient,
  user_id: string
): Promise<any[]> {
  const { data, error } = await supabase
    .from("follows")
    .select("profile:profiles!follows_follower_id_fkey(id, username, display_name, avatar_url)")
    .eq("following_id", user_id)
  if (error) throw error
  return (data ?? []).map((d: any) => d.profile).filter(Boolean)
}

export async function getFollowing(
  supabase: SupabaseClient,
  user_id: string
): Promise<any[]> {
  const { data, error } = await supabase
    .from("follows")
    .select("profile:profiles!follows_following_id_fkey(id, username, display_name, avatar_url)")
    .eq("follower_id", user_id)
  if (error) throw error
  return (data ?? []).map((d: any) => d.profile).filter(Boolean)
}

export async function getProfile(
  supabase: SupabaseClient,
  user_id: string
): Promise<any | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user_id)
    .single()
  if (error) return null
  return data
}

export async function updateProfile(
  supabase: SupabaseClient,
  { user_id, updates }: { user_id: string; updates: Record<string, any> }
): Promise<any> {
  const { data, error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", user_id)
    .select()
    .single()
  if (error) throw error
  return data
}
