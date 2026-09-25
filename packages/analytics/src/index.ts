// ─── Product analytics & error reporting ─────────────────────────────────────
// Browser-only and off unless configured:
//   NEXT_PUBLIC_POSTHOG_KEY (+ optional NEXT_PUBLIC_POSTHOG_HOST)  → PostHog
//   NEXT_PUBLIC_SENTRY_DSN                                          → Sentry
// Both SDKs are imported lazily, so apps without keys ship none of their code.
// Events never include email or free text (notes, comments); ids and flags only.

import type { AppId } from "@niche/shared-types"

/** The events behind the activation funnel and retention cohorts. */
export type AnalyticsEvent =
  | "signed_up"
  | "signed_in"
  | "niche_joined"
  | "cup_logged"
  | "cafe_autodetected"
  | "cafe_autodetect_rejected"
  | "cup_ranked"
  | "cup_rank_skipped"
  | "cup_deleted"
  | "cheer_sent"
  | "cup_saved"
  | "comment_sent"
  | "friend_followed"
  | "friend_unfollowed"
  | "user_blocked"
  | "content_reported"
  | "account_deleted"

type Props = Record<string, string | number | boolean | null | undefined>

type PostHog = typeof import("posthog-js").default
type Sentry = typeof import("@sentry/browser")

let posthog: PostHog | null = null
let sentry: Sentry | null = null
let started = false
const queued: [AnalyticsEvent, Props | undefined][] = []

/** Call once on the client with the signed-in user (or null). */
export async function initObservability({ app, userId }: { app: AppId; userId: string | null }) {
  if (typeof window === "undefined" || started) return
  started = true

  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN

  await Promise.all([
    key && import("posthog-js").then(({ default: ph }) => {
      ph.init(key, {
        api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
        capture_pageview: "history_change",
        person_profiles: "identified_only",
        // Session replay off: notes and comments are personal.
        disable_session_recording: true,
      })
      ph.register({ app })
      if (userId) ph.identify(userId)
      posthog = ph
    }).catch(() => {}),
    dsn && import("@sentry/browser").then(s => {
      s.init({ dsn, environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? "development", tracesSampleRate: 0.1, sendDefaultPii: false })
      s.setTag("app", app)
      if (userId) s.setUser({ id: userId })
      sentry = s
    }).catch(() => {}),
  ])

  for (const [event, props] of queued.splice(0)) posthog?.capture(event, props)
}

export function track(event: AnalyticsEvent, props?: Props) {
  if (typeof window === "undefined") return
  if (posthog) posthog.capture(event, props)
  else if (!started || queued.length < 50) queued.push([event, props])
}

export function captureError(error: unknown, context?: Props) {
  if (sentry) sentry.captureException(error, { extra: context })
}

/** On sign-out or account deletion, so the next person on the device starts fresh. */
export function resetIdentity() {
  posthog?.reset()
  sentry?.setUser(null)
}
