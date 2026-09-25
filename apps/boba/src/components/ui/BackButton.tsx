"use client"

import { useRouter } from "next/navigation"
import { BackIcon } from "./Primitives"

/** Goes back when there is history (tapped in from a feed), otherwise home. */
export default function BackButton({ fallback = "/" }: { fallback?: string }) {
  const router = useRouter()
  return (
    <button
      type="button"
      aria-label="Back"
      className="icon-btn"
      onClick={() => (window.history.length > 1 ? router.back() : router.push(fallback))}
    >
      <BackIcon />
    </button>
  )
}
