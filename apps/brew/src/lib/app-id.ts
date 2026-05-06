import type { AppId } from "@niche/shared-types"

// next.config.js sets NEXT_PUBLIC_APP_ID at build time. Falling back to
// "brew" keeps server-side rendering working when env vars haven't been
// inlined (e.g. in some test setups).
export const APP_ID: AppId = (process.env.NEXT_PUBLIC_APP_ID as AppId) ?? "brew"
