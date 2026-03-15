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

function normalizeReviewRecord(review: any, user_id?: string) {
  const { votes, likes, user, profile, ...rest } = review
  const actor = user ?? profile ?? null
  const voteState = votes ? aggregateVotes(votes, user_id) : aggregateLegacyLikes(likes)

  return {
    ...rest,
    ...(actor ? { user: actor, profile: actor } : null),
    ...voteState,
  }
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
