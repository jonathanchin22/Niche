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

function isReviewVotesSchemaError(error: any) {
  const message = `${error?.message ?? ""} ${error?.details ?? ""} ${error?.hint ?? ""}`.toLowerCase()
  return error?.code === "PGRST200" || message.includes("review_votes") || message.includes("could not find a relationship")
}

function aggregateLegacyLikes(likes: any[]) {
  const firstLike = Array.isArray(likes) ? likes[0] : likes
  const count = Number(firstLike?.count ?? 0)
  return { upvotes_count: count, downvotes_count: 0, likes_count: count, user_vote: 0 as const }
}

function aggregateCommentsCount(comments_meta: any[]) {
  const firstMeta = Array.isArray(comments_meta) ? comments_meta[0] : comments_meta
  return Number(firstMeta?.count ?? 0)
}

function normalizeReviewRecord(review: any, user_id?: string) {
  const { votes, likes, comments_meta, user, profile, ...rest } = review
  const actor = user ?? profile ?? null
  const voteState = votes ? aggregateVotes(votes, user_id) : aggregateLegacyLikes(likes)
  const comments_count = aggregateCommentsCount(comments_meta)

  return {
    ...rest,
    ...(actor ? { user: actor, profile: actor } : null),
    ...voteState,
    comments_count,
  }
}

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
  const { data: votes, error } = await supabase
    .from("review_votes")
    .select("vote, user_id")
    .eq("review_id", review_id)
  if (error) {
    if (!isReviewVotesSchemaError(error)) throw error

    const { data: likes, error: likesError } = await supabase
      .from("review_likes")
      .select("user_id")
      .eq("review_id", review_id)
    if (likesError) throw likesError

    const upvotes = likes?.length ?? 0
    const user_vote = (likes ?? []).some((like: any) => like.user_id === user_id) ? 1 : 0
    return { upvotes, downvotes: 0, user_vote }
  }
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
  if (error) throw error
  return data ?? []
}

// ─── Feed ────────────────────────────────────────────────────────────────────

function aggregateVotes(votes: any[], user_id?: string) {
  let upvotes_count = 0, downvotes_count = 0, user_vote: 1 | -1 | 0 = 0
  for (const v of votes ?? []) {
    if (v.vote === 1) upvotes_count++
    if (v.vote === -1) downvotes_count++
    if (user_id && v.user_id === user_id) user_vote = v.vote
  }
  return { upvotes_count, downvotes_count, likes_count: upvotes_count, user_vote }
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

  // Step 2: fetch reviews with related data
  const buildVotesQuery = () => {
    let query = supabase
      .from("reviews")
      .select(`
        id, app_id, user_id, place_id, score, category, item_name, note, image_urls, tags, taste_attributes, customizations, toppings, quality_signals, visit_context, revisit_intent, price_paid, created_at, updated_at,
        profile:profiles!reviews_user_id_fkey(id, username, display_name, avatar_url),
        place:places!reviews_place_id_fkey(id, name, address, app_id),
        comments_meta:review_comments(count),
        votes:review_votes(vote, user_id)
      `)
      .eq("app_id", app_id)
      .in("user_id", followingIds.length > 0 ? followingIds : ["00000000-0000-0000-0000-000000000000"])
      .order("created_at", { ascending: false })
      .limit(limit)

    if (cursor) query = query.lt("created_at", cursor)
    return query
  }

  const { data, error } = await buildVotesQuery()
  if (error) {
    console.error("getFriendFeed error:", error)

    if (!isReviewVotesSchemaError(error)) {
      let fallback = supabase
        .from("reviews")
        .select("id, app_id, user_id, place_id, score, category, item_name, note, image_urls, tags, taste_attributes, customizations, toppings, quality_signals, visit_context, revisit_intent, price_paid, created_at, updated_at")
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

    let legacyQuery = supabase
      .from("reviews")
      .select(`
        id, app_id, user_id, place_id, score, category, item_name, note, image_urls, tags, taste_attributes, customizations, toppings, quality_signals, visit_context, revisit_intent, price_paid, created_at, updated_at,
        profile:profiles!reviews_user_id_fkey(id, username, display_name, avatar_url),
        place:places!reviews_place_id_fkey(id, name, address, app_id),
        comments_meta:review_comments(count),
        likes:review_likes(count)
      `)
      .eq("app_id", app_id)
      .in("user_id", followingIds.length > 0 ? followingIds : ["00000000-0000-0000-0000-000000000000"])
      .order("created_at", { ascending: false })
      .limit(limit)
    if (cursor) legacyQuery = legacyQuery.lt("created_at", cursor)

    const { data: legacyData, error: legacyError } = await legacyQuery
    if (legacyError) throw legacyError
    const items = (legacyData ?? []).map((r: any) => ({ review: normalizeReviewRecord(r, user_id) }))
    const nextCursor = legacyData?.length === limit ? legacyData[legacyData.length - 1]?.created_at : undefined
    return { data: items, cursor: nextCursor, has_more: !!nextCursor }
  }

  const items = (data ?? []).map((r: any) => ({ review: normalizeReviewRecord(r, user_id) }))
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
  const buildVotesQuery = () => {
    let query = supabase
      .from("reviews")
      .select(`
        id, app_id, user_id, place_id, score, category, item_name, note, image_urls, tags, taste_attributes, customizations, toppings, quality_signals, visit_context, revisit_intent, price_paid, created_at, updated_at,
        user:profiles!reviews_user_id_fkey(id, username, display_name, avatar_url),
        place:places!reviews_place_id_fkey(id, name, address, city, state, app_id),
        comments_meta:review_comments(count),
        votes:review_votes(vote, user_id)
      `)
      .eq("app_id", app_id)
      .in("user_id", followingIds.length > 0 ? followingIds : ["00000000-0000-0000-0000-000000000000"])
      .order("created_at", { ascending: false })
      .limit(limit)

    if (cursor) query = query.lt("created_at", cursor)
    return query
  }

  const { data, error } = await buildVotesQuery()
  if (error) {
    console.error("getMyFeed error:", error)

    if (!isReviewVotesSchemaError(error)) {
      let fallback = supabase
        .from("reviews")
        .select("id, app_id, user_id, place_id, score, category, item_name, note, image_urls, tags, taste_attributes, customizations, toppings, quality_signals, visit_context, revisit_intent, price_paid, created_at, updated_at")
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

    let legacyQuery = supabase
      .from("reviews")
      .select(`
        id, app_id, user_id, place_id, score, category, item_name, note, image_urls, tags, taste_attributes, customizations, toppings, quality_signals, visit_context, revisit_intent, price_paid, created_at, updated_at,
        user:profiles!reviews_user_id_fkey(id, username, display_name, avatar_url),
        place:places!reviews_place_id_fkey(id, name, address, city, state, app_id),
        comments_meta:review_comments(count),
        likes:review_likes(count)
      `)
      .eq("app_id", app_id)
      .in("user_id", followingIds.length > 0 ? followingIds : ["00000000-0000-0000-0000-000000000000"])
      .order("created_at", { ascending: false })
      .limit(limit)
    if (cursor) legacyQuery = legacyQuery.lt("created_at", cursor)

    const { data: legacyData, error: legacyError } = await legacyQuery
    if (legacyError) throw legacyError
    const items = (legacyData ?? []).map((r: any) => ({ review: normalizeReviewRecord(r, user_id) }))
    const nextCursor = legacyData?.length === limit ? legacyData[legacyData.length - 1]?.created_at : undefined
    return { data: items, cursor: nextCursor, has_more: !!nextCursor }
  }

  const items = (data ?? []).map((r: any) => ({ review: normalizeReviewRecord(r, user_id) }))
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
      comments_meta:review_comments(count),
      votes:review_votes(vote)
    `)
    .eq("app_id", app_id)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (cursor) query = query.lt("created_at", cursor)

  const { data, error } = await query
  if (error) {
    if (!isReviewVotesSchemaError(error)) throw error

    let legacyQuery = supabase
      .from("reviews")
      .select(`
        id, app_id, user_id, place_id, score, category, item_name, note, image_urls, tags, taste_attributes, customizations, toppings, quality_signals, visit_context, revisit_intent, price_paid, created_at, updated_at,
        user:profiles!reviews_user_id_fkey(id, username, display_name, avatar_url),
        place:places!reviews_place_id_fkey(id, name, address, city, state, app_id),
        comments_meta:review_comments(count),
        likes:review_likes(count)
      `)
      .eq("app_id", app_id)
      .order("created_at", { ascending: false })
      .limit(limit)
    if (cursor) legacyQuery = legacyQuery.lt("created_at", cursor)

    const { data: legacyData, error: legacyError } = await legacyQuery
    if (legacyError) throw legacyError

    const items = (legacyData ?? []).map((r: any) => ({ type: "review" as const, review: normalizeReviewRecord(r), created_at: r.created_at }))
    const nextCursor = legacyData?.length === limit ? legacyData[legacyData.length - 1]?.created_at : undefined
    return { data: items, cursor: nextCursor ?? null, has_more: !!nextCursor }
  }

  const items = (data ?? []).map((r: any) => ({ type: "review" as const, review: normalizeReviewRecord(r), created_at: r.created_at }))
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
      votes:review_votes(vote, user_id),
      comments:review_comments(*, profile:profiles!review_comments_user_id_fkey(*))
    `)
    .eq("id", review_id)
    .single()

  if (error) {
    if (!isReviewVotesSchemaError(error)) return null

    const { data: legacyData, error: legacyError } = await supabase
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
    if (legacyError) return null
    return normalizeReviewRecord(legacyData) as Review
  }

  return normalizeReviewRecord(data) as Review
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
      comments_meta:review_comments(count),
      votes:review_votes(vote, user_id)
    `)
    .eq("app_id", app_id)
    .eq("user_id", user_id)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (cursor) query = query.lt("created_at", cursor)

  const { data, error } = await query
  if (error) {
    if (!isReviewVotesSchemaError(error)) throw error

    let legacyQuery = supabase
      .from("reviews")
      .select(`
        *,
        profile:profiles!reviews_user_id_fkey(*),
        place:places!reviews_place_id_fkey(*),
        comments_meta:review_comments(count),
        likes:review_likes(count)
      `)
      .eq("app_id", app_id)
      .eq("user_id", user_id)
      .order("created_at", { ascending: false })
      .limit(limit)
    if (cursor) legacyQuery = legacyQuery.lt("created_at", cursor)

    const { data: legacyData, error: legacyError } = await legacyQuery
    if (legacyError) throw legacyError
    const items = (legacyData ?? []).map((r: any) => ({ review: normalizeReviewRecord(r, user_id) }))
    const nextCursor = legacyData?.length === limit ? legacyData[legacyData.length - 1]?.created_at : undefined
    return { data: items, cursor: nextCursor, has_more: !!nextCursor }
  }

  const items = (data ?? []).map((r: any) => ({ review: normalizeReviewRecord(r, user_id) }))
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
  try {
    await voteReview(supabase, { review_id, user_id, vote: 1 })
  } catch (error) {
    if (!isReviewVotesSchemaError(error)) throw error

    const { error: likeError } = await supabase
      .from("review_likes")
      .upsert({ review_id, user_id }, { onConflict: "review_id,user_id", ignoreDuplicates: true })
    if (likeError) throw likeError
  }
}

export async function unlikeReview(
  supabase: SupabaseClient,
  { review_id, user_id }: { review_id: string; user_id: string }
): Promise<void> {
  try {
    await removeReviewVote(supabase, { review_id, user_id })
  } catch (error) {
    if (!isReviewVotesSchemaError(error)) throw error

    const { error: unlikeError } = await supabase
      .from("review_likes")
      .delete()
      .eq("review_id", review_id)
      .eq("user_id", user_id)
    if (unlikeError) throw unlikeError
  }
}

export async function isReviewLiked(
  supabase: SupabaseClient,
  { review_id, user_id }: { review_id: string; user_id: string }
): Promise<boolean> {
  const { data, error } = await supabase
    .from("review_votes")
    .select("review_id")
    .eq("review_id", review_id)
    .eq("user_id", user_id)
    .eq("vote", 1)
    .maybeSingle()
  if (error) {
    if (!isReviewVotesSchemaError(error)) throw error

    const { data: legacyData, error: legacyError } = await supabase
      .from("review_likes")
      .select("review_id")
      .eq("review_id", review_id)
      .eq("user_id", user_id)
      .maybeSingle()
    if (legacyError) throw legacyError
    return !!legacyData
  }
  return !!data
}

export async function deleteReview(
  supabase: SupabaseClient,
  { review_id, user_id }: { review_id: string; user_id: string }
): Promise<void> {
  const { error } = await supabase
    .from("reviews")
    .delete()
    .eq("id", review_id)
    .eq("user_id", user_id)
  if (error) throw error
}

export async function updateReview(
  supabase: SupabaseClient,
  { review_id, updates }: {
    review_id: string
    updates: { item_name?: string | null; score?: number; body?: string | null; note?: string | null; tags?: string[]; image_urls?: string[] }
  }
) {
  const { body, note, ...restUpdates } = updates
  const normalizedNote = note ?? body

  const { data, error } = await supabase
    .from("reviews")
    .update({ ...restUpdates, ...(normalizedNote !== undefined ? { note: normalizedNote } : null), updated_at: new Date().toISOString() })
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
  if (rpcError) console.warn("get_map_pins RPC failed, using direct query:", rpcError.message)

  // Fallback: simple place query within bounds (no friend context).
  // Coordinates live in lat/lng — the latitude/longitude columns are legacy and usually null.
  const { data, error } = await supabase
    .from("places")
    .select("*")
    .eq("app_id", app_id)
    .gte("lat", bounds.south)
    .lte("lat", bounds.north)
    .gte("lng", bounds.west)
    .lte("lng", bounds.east)
    .limit(50)

  if (error) throw error
  return (data ?? []).map((p: any) => ({
    place: p,
    friend_count: 0,
    friend_avatars: [],
    top_score: p.avg_score ?? null,
  }))
}

// ─── Places ──────────────────────────────────────────────────────────────────

/**
 * Find or create a place record, preventing duplicate entries.
 *
 * Matching strategy:
 *   - When google_place_id is provided: match on (app_id, google_place_id).
 *   - When google_place_id is null: match on (app_id, lower(name)) so that
 *     manually-entered cafe names are deduplicated case-insensitively.
 *
 * Uses the find_or_create_place() DB function introduced in migration 006.
 * Falls back to the legacy upsert path if the RPC is unavailable.
 */
export async function upsertPlace(
  supabase: SupabaseClient,
  place: Omit<Place, "id" | "created_at" | "avg_score" | "review_count" | "updated_at">
): Promise<Place> {
  // Try the normalizing RPC first (available after migration 006)
  const { data: placeId, error: rpcError } = await supabase.rpc("find_or_create_place", {
    p_app_id:          place.app_id,
    p_name:            place.name,
    p_address:         place.address ?? "",
    p_city:            place.city ?? "",
    p_state:           place.state ?? "",
    p_country:         place.country ?? "US",
    p_lat:             place.lat ?? 0,
    p_lng:             place.lng ?? 0,
    p_google_place_id: place.google_place_id ?? null,
    p_foursquare_id:   place.foursquare_id ?? null,
    p_cover_image_url: place.cover_image_url ?? null,
  })

  if (!rpcError && placeId) {
    const { data, error } = await supabase
      .from("places")
      .select("*")
      .eq("id", placeId)
      .single()
    if (!error && data) return data
  }
  if (rpcError) console.warn("find_or_create_place RPC failed, using legacy upsert:", rpcError.message)

  // Legacy fallback — only reached when the find_or_create_place RPC is
  // unavailable (i.e., migration 006 has not yet been applied).
  // TODO: Remove this fallback once all environments have run migration 006.
  if (place.google_place_id) {
    const { data, error } = await supabase
      .from("places")
      .upsert(place, { onConflict: "app_id,google_place_id" })
      .select()
      .single()
    if (error) throw error
    return data
  }

  // No google_place_id — try name-based lookup before inserting.
  // This mirrors the RPC logic for pre-migration environments.
  const { data: existing } = await supabase
    .from("places")
    .select("*")
    .eq("app_id", place.app_id)
    .ilike("name", place.name)
    .is("google_place_id", null)
    .limit(1)
    .maybeSingle()

  if (existing) return existing

  const { data, error } = await supabase
    .from("places")
    .insert(place)
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
      votes:review_votes(vote)
    `)
    .eq("place_id", place_id)
    .order("created_at", { ascending: false })
    .limit(limit)
  if (error) {
    if (!isReviewVotesSchemaError(error)) throw error

    const { data: legacyData, error: legacyError } = await supabase
      .from("reviews")
      .select(`
        *,
        profile:profiles!reviews_user_id_fkey(*),
        likes:review_likes(count)
      `)
      .eq("place_id", place_id)
      .order("created_at", { ascending: false })
      .limit(limit)
    if (legacyError) throw legacyError
    return (legacyData ?? []).map((r: any) => ({ review: normalizeReviewRecord(r) }))
  }
  return (data ?? []).map((r: any) => ({ review: normalizeReviewRecord(r) }))
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
    // % and _ are LIKE wildcards; escape them so "7_leaves" means what it says.
    .ilike("name", `%${query.replace(/[\\%_]/g, "\\$&")}%`)
    .order("review_count", { ascending: false })
    .limit(20)
  if (error) throw error
  return data ?? []
}

export async function searchUsers(
  supabase: SupabaseClient,
  { query, current_user_id }: { query: string; current_user_id: string }
): Promise<any[]> {
  // Commas, parentheses and wildcards are PostgREST filter syntax — strip them
  // so a search like "smith, j" doesn't produce a malformed .or() filter.
  const term = query.replace(/[,()%*\\]/g, " ").trim()
  if (!term) return []

  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url")
    .or(`username.ilike.%${term}%,display_name.ilike.%${term}%`)
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

// ─── Cheers, saves & discovery (brew redesign) ───────────────────────────────
// "Cheers" are review_votes with vote = 1 (upvotes_count on normalized reviews).
// "Want to try" saves live in review_saves (migration 008).

const REVIEW_CARD_SELECT = `
  id, app_id, user_id, place_id, score, category, item_name, note, image_urls, tags, taste_attributes, toppings, created_at, updated_at,
  user:profiles!reviews_user_id_fkey(id, username, display_name, avatar_url),
  place:places!reviews_place_id_fkey(id, name, city, state, cover_image_url, google_place_id, lat, lng),
  comments_meta:review_comments(count),
  votes:review_votes(vote, user_id)
`

const DAY_MS = 24 * 60 * 60 * 1000

async function getFollowingIds(supabase: SupabaseClient, user_id: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("follows")
    .select("following_id")
    .eq("follower_id", user_id)
  if (error) throw error
  return (data ?? []).map((f: any) => f.following_id)
}

export async function cheerReview(
  supabase: SupabaseClient,
  { review_id, user_id }: { review_id: string; user_id: string }
): Promise<void> {
  await voteReview(supabase, { review_id, user_id, vote: 1 })
}

export async function uncheerReview(
  supabase: SupabaseClient,
  { review_id, user_id }: { review_id: string; user_id: string }
): Promise<void> {
  await removeReviewVote(supabase, { review_id, user_id })
}

export async function saveReview(
  supabase: SupabaseClient,
  { review_id, user_id }: { review_id: string; user_id: string }
): Promise<void> {
  const { error } = await supabase
    .from("review_saves")
    .upsert({ review_id, user_id }, { onConflict: "user_id,review_id", ignoreDuplicates: true })
  if (error) throw error
}

export async function unsaveReview(
  supabase: SupabaseClient,
  { review_id, user_id }: { review_id: string; user_id: string }
): Promise<void> {
  const { error } = await supabase
    .from("review_saves")
    .delete()
    .eq("review_id", review_id)
    .eq("user_id", user_id)
  if (error) throw error
}

export async function isReviewSaved(
  supabase: SupabaseClient,
  { review_id, user_id }: { review_id: string; user_id: string }
): Promise<boolean> {
  const { data, error } = await supabase
    .from("review_saves")
    .select("review_id")
    .eq("review_id", review_id)
    .eq("user_id", user_id)
    .maybeSingle()
  if (error) throw error
  return !!data
}

/** Reviews the user saved to "want to try", newest save first. */
export async function getSavedReviews(
  supabase: SupabaseClient,
  { user_id, app_id, limit = 60 }: { user_id: string; app_id: AppId; limit?: number }
): Promise<Review[]> {
  const { data, error } = await supabase
    .from("review_saves")
    .select(`created_at, review:reviews!review_saves_review_id_fkey(${REVIEW_CARD_SELECT})`)
    .eq("user_id", user_id)
    .order("created_at", { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? [])
    .map((row: any) => row.review)
    .filter((r: any) => r && r.app_id === app_id)
    .map((r: any) => normalizeReviewRecord(r, user_id) as Review)
}

/** A single review with its author, place, cheers and comments, from the viewer's point of view. */
export async function getReviewDetail(
  supabase: SupabaseClient,
  { review_id, user_id }: { review_id: string; user_id: string }
): Promise<(Review & { comments: any[]; saved: boolean }) | null> {
  const { data, error } = await supabase
    .from("reviews")
    .select(`${REVIEW_CARD_SELECT},
      comments:review_comments(id, body, created_at, user_id, user:profiles!review_comments_user_id_fkey(id, username, display_name, avatar_url)),
      saves:review_saves(user_id)`)
    .eq("id", review_id)
    .maybeSingle()
  if (error) throw error
  if (!data) return null

  // RLS only returns saves the viewer made (or all of them, to the author).
  const saved = (data.saves ?? []).some((s: any) => s.user_id === user_id)
  const comments = [...(data.comments ?? [])].sort(
    (a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  )
  return { ...(normalizeReviewRecord(data, user_id) as Review), comments, saved }
}

/** Reviews by the people the user follows (optionally including their own) since a point in time. */
export async function getFriendReviewsSince(
  supabase: SupabaseClient,
  { user_id, app_id, since, limit = 40, includeSelf = false, ids: knownIds }:
    { user_id: string; app_id: AppId; since?: Date; limit?: number; includeSelf?: boolean; ids?: string[] }
): Promise<Review[]> {
  const ids = [...(knownIds ?? await getFollowingIds(supabase, user_id))]
  if (includeSelf) ids.push(user_id)
  if (ids.length === 0) return []

  let query = supabase
    .from("reviews")
    .select(REVIEW_CARD_SELECT)
    .eq("app_id", app_id)
    .in("user_id", ids)
    .order("created_at", { ascending: false })
    .limit(limit)
  if (since) query = query.gte("created_at", since.toISOString())

  const { data, error } = await query
  if (error) throw error
  return (data ?? []).map((r: any) => normalizeReviewRecord(r, user_id) as Review)
}

export interface HomeFeed {
  /** The cup set large at the top of the page. */
  cover: Review | null
  /** How recent the cover is, for its caption. */
  coverWhen: "today" | "week" | "earlier"
  /** Everything else, newest first. */
  entries: Review[]
  /** Whether the user follows anyone (drives the empty state). */
  followsAnyone: boolean
  /** No cups of their own and nobody followed: show the welcome page. */
  isNewcomer: boolean
  /**
   * Recent cups from people the user doesn't follow yet, so the page is
   * never empty. Shown under its own heading, never mixed into friends.
   */
  community: Review[]
}

/**
 * The home feed: the user's and their friends' cups, newest first, with the
 * best recent one pulled out as the cover. Two round trips in total
 * (follow list, then one reviews query), however old the cups are.
 */
export async function getHomeFeed(
  supabase: SupabaseClient,
  { user_id, app_id, limit = 40 }: { user_id: string; app_id: AppId; limit?: number }
): Promise<HomeFeed> {
  const following = await getFollowingIds(supabase, user_id)
  const [reviews, community] = await Promise.all([
    getFriendReviewsSince(supabase, { user_id, app_id, limit, includeSelf: true, ids: following }),
    getCommunityCups(supabase, { user_id, app_id, exclude: following }).catch(() => []),
  ])

  const now = Date.now()
  const age = (r: Review) => now - new Date(r.created_at).getTime()
  const byScore = (list: Review[]) => [...list].sort((a, b) => Number(b.score) - Number(a.score))
  const pick = (list: Review[]) => { const ranked = byScore(list); return ranked.find(r => r.image_urls?.length) ?? ranked[0] ?? null }

  // Prefer a friend's cup over your own, and a recent one over an old one.
  const friends = reviews.filter(r => r.user_id !== user_id)
  const pool = friends.length ? friends : reviews
  const today = pool.filter(r => age(r) < DAY_MS * 1.5)
  const week = pool.filter(r => age(r) < 7 * DAY_MS)
  const cover = pick(today) ?? pick(week) ?? pool.find(r => r.image_urls?.length) ?? pool[0] ?? null
  const coverWhen = !cover ? "earlier" : age(cover) < DAY_MS * 1.5 ? "today" : age(cover) < 7 * DAY_MS ? "week" : "earlier"

  return {
    cover,
    coverWhen,
    entries: reviews.filter(r => r.id !== cover?.id),
    followsAnyone: following.length > 0,
    isNewcomer: following.length === 0 && !reviews.some(r => r.user_id === user_id),
    community,
  }
}

/** Recent cups in this app from people the user doesn't follow (or themselves), photos first. */
export async function getCommunityCups(
  supabase: SupabaseClient,
  { user_id, app_id, exclude = [], limit = 12 }: { user_id: string; app_id: AppId; exclude?: string[]; limit?: number }
): Promise<Review[]> {
  const skip = [...exclude, user_id]
  const { data, error } = await supabase
    .from("reviews")
    .select(REVIEW_CARD_SELECT)
    .eq("app_id", app_id)
    .not("user_id", "in", `(${skip.join(",")})`)
    .order("created_at", { ascending: false })
    .limit(limit * 2)
  if (error) throw error
  const cups: Review[] = (data ?? []).map((r: any) => normalizeReviewRecord(r, user_id) as Review)
  // Everyone's newest cup first, then their second; no more than two each,
  // so it never reads like a single stranger's diary.
  const count = new Map<string, number>()
  const capped = cups.filter(r => {
    const n = (count.get(r.user_id) ?? 0) + 1
    count.set(r.user_id, n)
    return n <= 2
  })
  const firsts = capped.filter((r, i) => capped.findIndex(c => c.user_id === r.user_id) === i)
  return [...firsts, ...capped.filter(r => !firsts.includes(r))].slice(0, limit)
}

// ─── Safety: block, report, delete account ───────────────────────────────────

export async function blockUser(supabase: SupabaseClient, { blocker_id, blocked_id }: { blocker_id: string; blocked_id: string }): Promise<void> {
  const { error } = await supabase
    .from("blocks")
    .upsert({ blocker_id, blocked_id }, { onConflict: "blocker_id,blocked_id", ignoreDuplicates: true })
  if (error) throw error
}

export async function unblockUser(supabase: SupabaseClient, { blocker_id, blocked_id }: { blocker_id: string; blocked_id: string }): Promise<void> {
  const { error } = await supabase.from("blocks").delete().eq("blocker_id", blocker_id).eq("blocked_id", blocked_id)
  if (error) throw error
}

export async function getBlockedUsers(
  supabase: SupabaseClient,
  user_id: string
): Promise<{ id: string; username: string; display_name: string; avatar_url: string | null }[]> {
  const { data, error } = await supabase
    .from("blocks")
    .select("created_at, profile:profiles!blocks_blocked_id_fkey(id, username, display_name, avatar_url)")
    .eq("blocker_id", user_id)
    .order("created_at", { ascending: false })
  if (error) throw error
  return (data ?? []).map((b: any) => b.profile).filter(Boolean)
}

export async function isBlocking(supabase: SupabaseClient, { blocker_id, blocked_id }: { blocker_id: string; blocked_id: string }): Promise<boolean> {
  const { data, error } = await supabase
    .from("blocks")
    .select("blocked_id")
    .eq("blocker_id", blocker_id)
    .eq("blocked_id", blocked_id)
    .maybeSingle()
  if (error) throw error
  return !!data
}

export type ReportReason = "spam" | "harassment" | "inappropriate" | "fake" | "other"

export async function reportContent(
  supabase: SupabaseClient,
  report: { reporter_id: string; reason: ReportReason; details?: string | null; review_id?: string | null; comment_id?: string | null; reported_user_id?: string | null }
): Promise<void> {
  const { error } = await supabase.from("reports").insert(report)
  if (error) throw error
}

/**
 * Deletes the signed-in user's photos (every app folder) and then their
 * account; everything else cascades in the database (migration 011).
 */
export async function deleteMyAccount(supabase: SupabaseClient, { user_id, apps }: { user_id: string; apps: AppId[] }): Promise<void> {
  for (const app of apps) {
    const folder = `${app}/${user_id}`
    const { data: files } = await supabase.storage.from("review-images").list(folder, { limit: 1000 })
    if (files?.length) {
      await supabase.storage.from("review-images").remove(files.map((f: any) => `${folder}/${f.name}`))
    }
  }
  const { error } = await supabase.rpc("delete_my_account")
  if (error) throw error
}

// ─── Personal rankings ("which was better?") ────────────────────────────────

/** The user's other cups in this app, best first — the ladder a new cup is compared against. */
export async function getRankLadder(
  supabase: SupabaseClient,
  { user_id, app_id, exclude_review_id }: { user_id: string; app_id: AppId; exclude_review_id?: string }
): Promise<Review[]> {
  let query = supabase
    .from("reviews")
    .select(REVIEW_CARD_SELECT + ", personal_rank")
    .eq("user_id", user_id)
    .eq("app_id", app_id)
    .order("created_at", { ascending: false })
    .limit(200)
  if (exclude_review_id) query = query.neq("id", exclude_review_id)
  const { data, error } = await query
  if (error) throw error
  const cups: Review[] = (data ?? []).map((r: any) => normalizeReviewRecord(r, user_id) as Review)
  return cups.sort(byPersonalRank)
}

/** Best first. Cups never compared (personal_rank null) sit at their score. */
export function byPersonalRank(a: { personal_rank?: number | null; score: number }, b: { personal_rank?: number | null; score: number }) {
  return Number(b.personal_rank ?? b.score) - Number(a.personal_rank ?? a.score) || Number(b.score) - Number(a.score)
}

export async function setPersonalRank(
  supabase: SupabaseClient,
  { review_id, user_id, personal_rank }: { review_id: string; user_id: string; personal_rank: number }
): Promise<void> {
  const { error } = await supabase
    .from("reviews")
    .update({ personal_rank })
    .eq("id", review_id)
    .eq("user_id", user_id)
  if (error) throw error
}

/** Where a cup sits in its owner's ranking: 1 = their favourite. */
export async function getPersonalRankPosition(
  supabase: SupabaseClient,
  { review_id, user_id, app_id }: { review_id: string; user_id: string; app_id: AppId }
): Promise<{ position: number; total: number } | null> {
  const { data, error } = await supabase
    .from("reviews")
    .select("id, personal_rank, score")
    .eq("user_id", user_id)
    .eq("app_id", app_id)
    .limit(1000)
  if (error) throw error
  const ids = [...(data ?? [])].sort(byPersonalRank).map((r: any) => r.id)
  const index = ids.indexOf(review_id)
  return index === -1 ? null : { position: index + 1, total: ids.length }
}

export interface LovedPlace {
  place: any
  avg_score: number
  cups: number
  friends: string[]
  photo: string | null
  categories: string[]
}

/** Cafés ranked by how many of the user's friends logged cups there. Falls back to the app's busiest cafés. */
export async function getFriendsLovedPlaces(
  supabase: SupabaseClient,
  { user_id, app_id, limit = 12 }: { user_id: string; app_id: AppId; limit?: number }
): Promise<LovedPlace[]> {
  const reviews = await getFriendReviewsSince(supabase, { user_id, app_id, limit: 300 })
  const byPlace = new Map<string, { place: any; scores: number[]; friends: Set<string>; photo: string | null; categories: Set<string> }>()

  for (const r of reviews as any[]) {
    if (!r.place || r.place.google_place_id?.endsWith("_home")) continue
    const entry = byPlace.get(r.place_id) ?? {
      place: r.place, scores: [] as number[], friends: new Set<string>(),
      photo: r.place.cover_image_url ?? null, categories: new Set<string>(),
    }
    entry.scores.push(Number(r.score))
    if (r.user?.username) entry.friends.add(r.user.username)
    if (!entry.photo && r.image_urls?.[0]) entry.photo = r.image_urls[0]
    if (r.category) entry.categories.add(r.category)
    byPlace.set(r.place_id, entry)
  }

  if (byPlace.size > 0) {
    return Array.from(byPlace.values())
      .map(e => ({
        place: e.place,
        avg_score: e.scores.reduce((a, b) => a + b, 0) / e.scores.length,
        cups: e.scores.length,
        friends: Array.from(e.friends),
        photo: e.photo,
        categories: Array.from(e.categories),
      }))
      .sort((a, b) => b.friends.length - a.friends.length || b.avg_score - a.avg_score)
      .slice(0, limit)
  }

  const { data, error } = await supabase
    .from("places")
    .select("*")
    .eq("app_id", app_id)
    .gt("review_count", 0)
    // Skip each app's shared "at home" place ("brew_home", "boba_home"). A plain
    // .neq() would also drop places whose google_place_id is NULL.
    .or("google_place_id.is.null,google_place_id.not.like.*_home")
    .order("review_count", { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []).map((p: any) => ({
    place: p,
    avg_score: Number(p.avg_score ?? 0),
    cups: p.review_count,
    friends: [],
    photo: p.cover_image_url ?? null,
    categories: [],
  }))
}

export type ActivityKind = "cheer" | "save" | "comment" | "follow" | "log"

export interface ActivityItem {
  id: string
  kind: ActivityKind
  actor: { id: string; username: string; display_name: string; avatar_url: string | null } | null
  review: any | null
  created_at: string
}

/** What happened lately: reactions to the user's cups, new followers, and friends' new logs. */
export async function getActivity(
  supabase: SupabaseClient,
  { user_id, app_id, limit = 30 }: { user_id: string; app_id: AppId; limit?: number }
): Promise<ActivityItem[]> {
  const kindByType: Record<string, ActivityKind> = {
    review_like: "cheer", review_saved: "save", review_comment: "comment", new_follower: "follow",
  }

  const [{ data: notes, error }, logs] = await Promise.all([
    supabase
      .from("notifications")
      .select(`id, type, created_at,
        actor:profiles!notifications_actor_id_fkey(id, username, display_name, avatar_url),
        review:reviews!notifications_review_id_fkey(id, app_id, item_name, image_urls, category, place:places!reviews_place_id_fkey(name, google_place_id))`)
      .eq("user_id", user_id)
      .order("created_at", { ascending: false })
      .limit(limit),
    getFriendReviewsSince(supabase, { user_id, app_id, since: new Date(Date.now() - 14 * DAY_MS), limit: 20 }),
  ])
  if (error) throw error

  const fromNotes: ActivityItem[] = (notes ?? [])
    .filter((n: any) => kindByType[n.type] && (!n.review || n.review.app_id === app_id))
    .map((n: any) => ({ id: n.id, kind: kindByType[n.type]!, actor: n.actor, review: n.review, created_at: n.created_at }))

  const fromLogs: ActivityItem[] = (logs as any[]).map(r => ({
    id: `log-${r.id}`, kind: "log" as const, actor: r.user ?? null, review: r, created_at: r.created_at,
  }))

  return [...fromNotes, ...fromLogs]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, limit)
}

export interface SuggestedPerson {
  id: string
  username: string
  display_name: string
  avatar_url: string | null
  reason: string
}

/** People to follow: friends of friends first, then people already on another niche app. */
export async function getSuggestedPeople(
  supabase: SupabaseClient,
  { user_id, app_id, limit = 6 }: { user_id: string; app_id: AppId; limit?: number }
): Promise<SuggestedPerson[]> {
  const following = await getFollowingIds(supabase, user_id)
  const exclude = new Set([user_id, ...following])
  const reasons = new Map<string, string>()

  if (following.length > 0) {
    const { data, error } = await supabase
      .from("follows")
      .select("following_id, via:profiles!follows_follower_id_fkey(username)")
      .in("follower_id", following)
      .limit(200)
    if (error) throw error
    for (const f of data ?? []) {
      if (!exclude.has(f.following_id) && !reasons.has(f.following_id) && f.via?.username) {
        reasons.set(f.following_id, `followed by ${f.via.username}`)
      }
    }
  }

  if (reasons.size < limit) {
    const { data, error } = await supabase
      .from("app_memberships")
      .select("user_id, app_id")
      .neq("app_id", app_id)
      .order("joined_at", { ascending: false })
      .limit(100)
    if (error) throw error
    for (const m of data ?? []) {
      if (!exclude.has(m.user_id) && !reasons.has(m.user_id)) reasons.set(m.user_id, `on ${m.app_id}`)
    }
  }

  const ids = Array.from(reasons.keys()).slice(0, limit)
  if (ids.length === 0) return []

  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url")
    .in("id", ids)
  if (error) throw error
  return ids
    .map(id => (profiles ?? []).find((p: any) => p.id === id))
    .filter(Boolean)
    .map((p: any) => ({ ...p, reason: reasons.get(p.id)! }))
}

export interface UserStats {
  cups: number
  cafes: number
  avg_score: number | null
  top_category: string | null
}

export async function getUserStats(
  supabase: SupabaseClient,
  { user_id, app_id }: { user_id: string; app_id: AppId }
): Promise<UserStats> {
  const { data, error } = await supabase
    .from("reviews")
    .select("score, place_id, category")
    .eq("user_id", user_id)
    .eq("app_id", app_id)
  if (error) throw error
  const rows = data ?? []
  const counts = new Map<string, number>()
  for (const r of rows) if (r.category) counts.set(r.category, (counts.get(r.category) ?? 0) + 1)
  const top = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0]
  return {
    cups: rows.length,
    cafes: new Set(rows.map((r: any) => r.place_id)).size,
    avg_score: rows.length ? rows.reduce((s: number, r: any) => s + Number(r.score), 0) / rows.length : null,
    top_category: top?.[0] ?? null,
  }
}
export * from "./nearby"
