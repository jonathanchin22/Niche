"use client"

import { useEffect } from "react"
import { initObservability } from "@niche/analytics"

/** Starts analytics and error reporting once keys are configured (no-op otherwise). */
export default function Observability({ userId }: { userId: string | null }) {
  useEffect(() => { initObservability({ app: "brew", userId }) }, [userId])
  return null
}
