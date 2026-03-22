// ─── Review Voting ─────────────────────────────────────────────────────────
/**
 * Upvote or downvote a review. vote = 1 (upvote), -1 (downvote)
 */
export async function voteReview(
  supabase: SupabaseClient,
  { review_id, user_id, vote }: { review_id: string; user_id: string; vote: 1 | -1 }
): Promise<void> {
  const { error } = await supabase
    .from("review_votes")
    .upsert({ review_id, user_id, vote }, { onConflict: "review_id,user_id" })
  if (error) throw error
}

export async function removeReviewVote(
  supabase: SupabaseClient,
  { review_id, user_id }: { review_id: string; user_id: string }
): Promise<void> {
  const { error } = await supabase
    .from("review_votes")
    .delete()
    .eq("review_id", review_id)
    .eq("user_id", user_id)
  if (error) throw error
}

/**
 * Get upvote/downvote counts and the current user's vote for a review
 */
export async function getReviewVotes(
  supabase: SupabaseClient,
  { review_id, user_id }: { review_id: string; user_id: string }
): Promise<{ upvotes: number; downvotes: number; user_vote: 1 | -1 | 0 }> {
  // Get counts
  const { data: votes, error } = await supabase
    .from("review_votes")
    .select("vote, user_id")
    .eq("review_id", review_id)
  if (error) throw error
  let upvotes = 0, downvotes = 0, user_vote: 1 | -1 | 0 = 0
  for (const v of votes ?? []) {
    if (v.vote === 1) upvotes++
    if (v.vote === -1) downvotes++
    if (v.user_id === user_id) user_vote = v.vote
  }
  return { upvotes, downvotes, user_vote }
}

// ─── Review Comments ───────────────────────────────────────────────────────
/**
 * Add a comment to a review
 */
export async function addReviewComment(
  supabase: SupabaseClient,
  { review_id, user_id, body }: { review_id: string; user_id: string; body: string }
): Promise<void> {
  const { error } = await supabase
    .from("review_comments")
    .insert({ review_id, user_id, body })
  if (error) throw error
}

/**
 * Get all comments for a review (most recent first)
 */
export async function getReviewComments(
  supabase: SupabaseClient,
  { review_id }: { review_id: string }
): Promise<any[]> {
  const { data, error } = await supabase
    .from("review_comments")
    .select("*, user:profiles!review_comments_user_id_fkey(id, username, avatar_url)")
    .eq("review_id", review_id)
    .order("created_at", { ascending: false })
    .limit(50)
  if (error) throw error
  return data ?? []
}
import type { AppId, FeedItem, Place, PaginatedResponse, Review, MapPin, SearchResult, Notification, PlaceSaveListType, PlaceSave } from "@niche/shared-types"

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

function aggregateVotes(votes: any[], user_id?: string) {
  let upvotes_count = 0, downvotes_count = 0, user_vote: 1 | -1 | 0 = 0
  for (const v of votes ?? []) {
    if (v.vote === 1) upvotes_count++
    if (v.vote === -1) downvotes_count++
    if (user_id && v.user_id === user_id) user_vote = v.vote
  }
  return { upvotes_count, downvotes_count, user_vote }
}

function aggregateLikes(likes: any[], user_id?: string) {
  const likeRows = likes ?? []
  const likes_count = likeRows.length
  const user_has_liked = !!user_id && likeRows.some((l: any) => l.user_id === user_id)
  return {
    likes_count,
    user_has_liked,
    likes: [{ count: likes_count }],
  }
}

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

  if (followingIds.length === 0) {
    return { data: [], cursor: null, has_more: false }
  }

  // Step 2: fetch reviews with related data
  let query = supabase
    .from("reviews")
    .select(`
      id, app_id, user_id, place_id, score, category, item_name, note, image_urls, tags, taste_attributes, customizations, toppings, quality_signals, visit_context, revisit_intent, price_paid, created_at, updated_at,
      profile:profiles!reviews_user_id_fkey(id, username, display_name, avatar_url),
      place:places!reviews_place_id_fkey(id, name, address, app_id),
      likes:review_likes(user_id),
      votes:review_votes(vote, user_id)
    `)
    .eq("app_id", app_id)
    .in("user_id", followingIds)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (cursor) query = query.lt("created_at", cursor)

  const { data, error } = await query
  if (error) {
    console.error("getFriendFeed error:", error)
    // Fallback to simple query if joins fail
    let fallback = supabase
      .from("reviews")
      .select("id, app_id, user_id, place_id, score, category, item_name, note, image_urls, tags, taste_attributes, customizations, toppings, quality_signals, visit_context, revisit_intent, price_paid, created_at, updated_at")
      .eq("app_id", app_id)
      .in("user_id", followingIds)
      .order("created_at", { ascending: false })
      .limit(limit)
    if (cursor) fallback = fallback.lt("created_at", cursor)
    const { data: fallbackData, error: fallbackError } = await fallback
    if (fallbackError) throw fallbackError
    const items = (fallbackData ?? []).map((r: any) => ({ review: r }))
    const nextCursor = fallbackData?.length === limit ? fallbackData[fallbackData.length - 1]?.created_at : undefined
    return { data: items, cursor: nextCursor, has_more: !!nextCursor }
  }

  const items = (data ?? []).map((r: any) => {
    const { votes, likes, ...review } = r
    return { review: { ...review, ...aggregateVotes(votes, user_id), ...aggregateLikes(likes, user_id) } }
  })
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
  const feedUserIds = Array.from(new Set([...followingIds, user_id]))

  // Step 2: fetch reviews with related data
  let query = supabase
    .from("reviews")
    .select(`
      id, app_id, user_id, place_id, score, category, item_name, note, image_urls, tags, taste_attributes, customizations, toppings, quality_signals, visit_context, revisit_intent, price_paid, created_at, updated_at,
      user:profiles!reviews_user_id_fkey(id, username, display_name, avatar_url),
      place:places!reviews_place_id_fkey(id, name, address, city, state, app_id),
      likes:review_likes(user_id),
      votes:review_votes(vote, user_id)
    `)
    .eq("app_id", app_id)
    .in("user_id", feedUserIds)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (cursor) query = query.lt("created_at", cursor)

  const { data, error } = await query
  if (error) {
    console.error("getMyFeed error:", error)
    // Fallback to simple query if joins fail
    let fallback = supabase
      .from("reviews")
      .select("id, app_id, user_id, place_id, score, category, item_name, note, image_urls, tags, taste_attributes, customizations, toppings, quality_signals, visit_context, revisit_intent, price_paid, created_at, updated_at")
      .eq("app_id", app_id)
      .in("user_id", feedUserIds)
      .order("created_at", { ascending: false })
      .limit(limit)
    if (cursor) fallback = fallback.lt("created_at", cursor)
    const { data: fallbackData, error: fallbackError } = await fallback
    if (fallbackError) throw fallbackError
    const items = (fallbackData ?? []).map((r: any) => ({ review: r }))
    const nextCursor = fallbackData?.length === limit ? fallbackData[fallbackData.length - 1]?.created_at : undefined
    return { data: items, cursor: nextCursor, has_more: !!nextCursor }
  }

  const items = (data ?? []).map((r: any) => {
    const { votes, likes, ...review } = r
    return { review: { ...review, ...aggregateVotes(votes, user_id), ...aggregateLikes(likes, user_id) } }
  })
  const nextCursor = data?.length === limit ? data[data.length - 1]?.created_at : undefined
  return { data: items, cursor: nextCursor, has_more: !!nextCursor }
}

export async function getDiscoverFeed(
  supabase: SupabaseClient,
  { app_id, cursor, limit = 20 }: Omit<FeedParams, "user_id">
): Promise<PaginatedResponse<FeedItem>> {
  let query = supabase
    .from("reviews")
    .select(`
      id, app_id, user_id, place_id, score, category, item_name, note, image_urls, tags, taste_attributes, customizations, toppings, quality_signals, visit_context, revisit_intent, price_paid, created_at, updated_at,
      user:profiles!reviews_user_id_fkey(id, username, display_name, avatar_url),
      place:places!reviews_place_id_fkey(id, name, address, city, state, app_id),
      likes:review_likes(user_id),
      votes:review_votes(vote)
    `)
    .eq("app_id", app_id)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (cursor) query = query.lt("created_at", cursor)

  const { data, error } = await query
  if (error) throw error

  const items = (data ?? []).map((r: any) => {
    const { votes, likes, ...review } = r
    return { type: "review" as const, review: { ...review, ...aggregateVotes(votes), ...aggregateLikes(likes) }, created_at: r.created_at }
  })
  const nextCursor = data?.length === limit ? data[data.length - 1]?.created_at : undefined
  return { data: items, cursor: nextCursor ?? null, has_more: !!nextCursor }
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
      id, app_id, user_id, place_id, score, category, item_name, note, image_urls, tags, taste_attributes, customizations, toppings, quality_signals, visit_context, revisit_intent, price_paid, created_at, updated_at,
      profile:profiles!reviews_user_id_fkey(id, username, display_name, avatar_url),
      place:places!reviews_place_id_fkey(id, app_id, name, address, city, state, country, latitude, longitude, google_place_id, foursquare_id, cover_image_url, avg_score, review_count, created_at, updated_at),
      likes:review_likes(user_id),
      votes:review_votes(vote, user_id)
    `)
    .eq("app_id", app_id)
    .eq("user_id", user_id)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (cursor) query = query.lt("created_at", cursor)

  const { data, error } = await query
  if (error) throw error

  const items = (data ?? []).map((r: any) => {
    const { votes, likes, ...review } = r
    return { review: { ...review, ...aggregateVotes(votes, user_id), ...aggregateLikes(likes, user_id) } }
  })
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

// ─── Collections / Saved Places ─────────────────────────────────────────────

export async function savePlaceToList(
  supabase: SupabaseClient,
  {
    user_id,
    place_id,
    app_id,
    list_type,
  }: {
    user_id: string
    place_id: string
    app_id: AppId
    list_type: PlaceSaveListType
  }
): Promise<void> {
  const { error } = await supabase
    .from("place_saves")
    .upsert(
      { user_id, place_id, app_id, list_type },
      { onConflict: "user_id,place_id,app_id,list_type", ignoreDuplicates: true }
    )

  if (error) throw error
}

export async function unsavePlaceFromList(
  supabase: SupabaseClient,
  {
    user_id,
    place_id,
    app_id,
    list_type,
  }: {
    user_id: string
    place_id: string
    app_id: AppId
    list_type: PlaceSaveListType
  }
): Promise<void> {
  const { error } = await supabase
    .from("place_saves")
    .delete()
    .eq("user_id", user_id)
    .eq("place_id", place_id)
    .eq("app_id", app_id)
    .eq("list_type", list_type)

  if (error) throw error
}

export async function isPlaceSaved(
  supabase: SupabaseClient,
  {
    user_id,
    place_id,
    app_id,
    list_type,
  }: {
    user_id: string
    place_id: string
    app_id: AppId
    list_type: PlaceSaveListType
  }
): Promise<boolean> {
  const { data, error } = await supabase
    .from("place_saves")
    .select("id")
    .eq("user_id", user_id)
    .eq("place_id", place_id)
    .eq("app_id", app_id)
    .eq("list_type", list_type)
    .maybeSingle()

  if (error) throw error
  return !!data
}

export async function getPlaceSaves(
  supabase: SupabaseClient,
  {
    user_id,
    app_id,
    list_type,
  }: {
    user_id: string
    app_id: AppId
    list_type?: PlaceSaveListType
  }
): Promise<PlaceSave[]> {
  let query = supabase
    .from("place_saves")
    .select("id, user_id, place_id, app_id, list_type, created_at, place:places!place_saves_place_id_fkey(id, name, city, state, address, avg_score, review_count)")
    .eq("user_id", user_id)
    .eq("app_id", app_id)
    .order("created_at", { ascending: false })

  if (list_type) query = query.eq("list_type", list_type)

  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as PlaceSave[]
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

// ─── Notifications ───────────────────────────────────────────────────────────

export async function getNotifications(
  supabase: SupabaseClient,
  { user_id, limit = 50 }: { user_id: string; limit?: number }
): Promise<Notification[]> {
  const { data, error } = await supabase
    .from("notifications")
    .select(`
      id, user_id, type, actor_id, review_id, comment_id, badge_id, read, created_at,
      actor:profiles!notifications_actor_id_fkey(id, username, display_name, avatar_url),
      review:reviews!notifications_review_id_fkey(id, item_name, place_id, place:places!reviews_place_id_fkey(id, name))
    `)
    .eq("user_id", user_id)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error) throw error

  return (data ?? []).map((n: any) => ({
    id: n.id,
    user_id: n.user_id,
    type: n.type,
    actor_id: n.actor_id,
    review_id: n.review_id,
    comment_id: n.comment_id,
    badge_id: n.badge_id,
    read: n.read,
    created_at: n.created_at,
    actor: n.actor ?? null,
    review: n.review
      ? { id: n.review.id, item_name: n.review.item_name }
      : null,
    place: n.review?.place
      ? { id: n.review.place.id, name: n.review.place.name ?? "a place" }
      : null,
  }))
}

export async function markNotificationsRead(
  supabase: SupabaseClient,
  { user_id, ids }: { user_id: string; ids?: string[] }
): Promise<void> {
  let query = supabase
    .from("notifications")
    .update({ read: true })
    .eq("user_id", user_id)
    .eq("read", false)

  if (ids && ids.length > 0) query = query.in("id", ids)

  const { error } = await query
  if (error) throw error
}

export async function getUnreadNotificationCount(
  supabase: SupabaseClient,
  { user_id }: { user_id: string }
): Promise<number> {
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user_id)
    .eq("read", false)

  if (error) throw error
  return count ?? 0
}

export async function getTopPlaces(
  supabase: SupabaseClient,
  { app_id, limit = 20 }: { app_id: AppId; limit?: number }
): Promise<Pick<Place, "id" | "name" | "city" | "state" | "avg_score" | "review_count">[]> {
  const { data, error } = await supabase
    .from("places")
    .select("id, name, city, state, avg_score, review_count")
    .eq("app_id", app_id)
    .not("avg_score", "is", null)
    .order("avg_score", { ascending: false })
    .order("review_count", { ascending: false })
    .limit(limit)

  if (error) throw error
  return data ?? []
}

export async function getTopReviewers(
  supabase: SupabaseClient,
  { app_id, limit = 20 }: { app_id: AppId; limit?: number }
): Promise<any[]> {
  const { data, error } = await supabase
    .from("app_memberships")
    .select("user_id, xp, badges, user:profiles!app_memberships_user_id_fkey(id, username, display_name, avatar_url)")
    .eq("app_id", app_id)
    .order("xp", { ascending: false })
    .limit(limit)

  if (error) throw error
  return data ?? []
}

export async function getUserBadges(
  supabase: SupabaseClient,
  { user_id, app_id }: { user_id: string; app_id: AppId }
): Promise<string[]> {
  const { data, error } = await supabase
    .from("app_memberships")
    .select("badges")
    .eq("user_id", user_id)
    .eq("app_id", app_id)
    .maybeSingle()

  if (error) throw error

  const badges = data?.badges
  if (!Array.isArray(badges)) return []
  return badges
    .map((b: any) => (typeof b === "string" ? b : b?.id))
    .filter(Boolean)
}

export async function getHighestRatedCoffee(
  supabase: SupabaseClient,
  { user_id, app_id }: { user_id: string; app_id: AppId }
): Promise<string | null> {
  const { data, error } = await supabase
    .from("reviews")
    .select("item_name, score, created_at")
    .eq("user_id", user_id)
    .eq("app_id", app_id)
    .not("item_name", "is", null)
    .order("score", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return data?.item_name ?? null
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
