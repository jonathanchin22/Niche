import type { SupabaseClient } from "@supabase/supabase-js"
import type { AppId } from "@niche/shared-types"

// ─── Invite links (/i/<code>, migration 015) ─────────────────────────────────
// Someone who signs up from a friend's link follows them and is followed back,
// so their first feed already has a friend in it.

/** Holds a link's code between opening it and signing in (7 days). */
export const INVITE_COOKIE = "niche_invite"
export const INVITE_COOKIE_MAX_AGE = 60 * 60 * 24 * 7

export interface Inviter {
  id: string
  username: string
  display_name: string
  avatar_url: string | null
}

export type InviteResult =
  | { status: "self"; username: string }
  | (Inviter & {
      status: "ok"
      /** Credited to the inviter: a new account, followed back automatically. */
      credited: boolean
      /** The inviter follows the person who opened the link. */
      mutual: boolean
    })

/** A code as typed or pasted, or null if it can't be one. */
export function normalizeInviteCode(raw: string | null | undefined): string | null {
  const code = (raw ?? "").trim().toLowerCase()
  return /^[a-z0-9]{6,16}$/.test(code) ? code : null
}

/** Who a link is from. Null for an unknown code (or someone who blocked you). */
export async function getInvite(supabase: SupabaseClient, code: string): Promise<Inviter | null> {
  const normalized = normalizeInviteCode(code)
  if (!normalized) return null
  const { data, error } = await supabase.rpc("get_invite", { p_code: normalized })
  if (error) throw error
  const row = Array.isArray(data) ? data[0] : data
  return (row as Inviter | undefined) ?? null
}

/** The signed-in person's invite code, minted on first use. */
export async function getMyInviteCode(supabase: SupabaseClient): Promise<string> {
  const { data, error } = await supabase.rpc("my_invite_code")
  if (error) throw error
  return data as string
}

/** Follow the inviter (and, for a new account, be followed back). Null if the link is no good. */
export async function acceptInvite(
  supabase: SupabaseClient,
  { code, app_id }: { code: string; app_id: AppId }
): Promise<InviteResult | null> {
  const normalized = normalizeInviteCode(code)
  if (!normalized) return null
  const { data, error } = await supabase.rpc("accept_invite", { p_code: normalized, p_app_id: app_id })
  if (error) throw error
  return (data as InviteResult | null) ?? null
}

/** People who joined from this person's link, newest first. */
export async function getInviteJoins(
  supabase: SupabaseClient,
  { user_id, limit = 12 }: { user_id: string; limit?: number }
): Promise<Inviter[]> {
  const { data, error } = await supabase
    .from("invite_redemptions")
    .select("created_at, invitee:profiles!invite_redemptions_invitee_id_fkey(id, username, display_name, avatar_url)")
    .eq("inviter_id", user_id)
    .order("created_at", { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []).map((r: any) => r.invitee).filter(Boolean) as Inviter[]
}

/** Ids of people who joined from this person's link (for "joined from your invite"). */
export async function getInviteJoinIds(supabase: SupabaseClient, user_id: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("invite_redemptions")
    .select("invitee_id")
    .eq("inviter_id", user_id)
    .limit(500)
  if (error) return new Set()
  return new Set((data ?? []).map((r: any) => r.invitee_id as string))
}

// ─── Browser helpers ─────────────────────────────────────────────────────────

/** Remember a link's code so it can be claimed once the person is signed in. */
export function rememberInvite(code: string) {
  if (typeof document === "undefined") return
  const normalized = normalizeInviteCode(code)
  if (!normalized) return
  const secure = window.location.protocol === "https:" ? "; Secure" : ""
  document.cookie = `${INVITE_COOKIE}=${normalized}; Path=/; Max-Age=${INVITE_COOKIE_MAX_AGE}; SameSite=Lax${secure}`
}

/** Whether a remembered invite is waiting to be claimed. */
export function hasPendingInvite(): boolean {
  if (typeof document === "undefined") return false
  return document.cookie.split("; ").some(c => c.startsWith(`${INVITE_COOKIE}=`))
}
