"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@niche/auth"
import { ReviewCard } from "@/components/feed/ReviewCard"
import { AppShell } from "@/components/ui/AppShell"
import type { PaginatedResponse, FeedItem } from "@niche/shared-types"

interface ProfileClientProps {
  profile: any
  initialReviews: PaginatedResponse<FeedItem>
  userId: string
}

export default function ProfileClient({ profile, initialReviews, userId }: ProfileClientProps) {
  const router = useRouter()
  const supabase = createClient()
  const [showSignOut, setShowSignOut] = useState(false)
  const reviews = initialReviews.data ?? []

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push("/auth/login")
  }

  const name = profile?.display_name || profile?.username || "Boba Fan"
  const username = profile?.username
  const reviewCount = reviews.length
  const avgScore = reviewCount > 0
    ? (reviews.reduce((sum, item) => sum + (item.review?.score ?? 0), 0) / reviewCount).toFixed(1)
    : null

  return (
    <AppShell activeTab="profile">
      <div className="pb-6">
        {/* Profile header */}
        <div className="px-4 pt-6 pb-4 text-center">
          <div className="w-20 h-20 rounded-full flex items-center justify-center text-3xl font-black text-white mx-auto mb-3" style={{ background: "linear-gradient(135deg, #7C3AED, #9F67FF)" }}>
            {name[0]?.toUpperCase()}
          </div>
          <h2 className="text-xl font-black" style={{ color: "#12082A" }}>{name}</h2>
          {username && <p className="text-sm mt-0.5" style={{ color: "#6B5B8A" }}>@{username}</p>}

          {/* Stats */}
          <div className="flex justify-center gap-8 mt-4">
            <div className="text-center">
              <p className="text-2xl font-black" style={{ color: "#7C3AED" }}>{reviewCount}</p>
              <p className="text-xs font-medium" style={{ color: "#6B5B8A" }}>Reviews</p>
            </div>
            {avgScore && (
              <div className="text-center">
                <p className="text-2xl font-black" style={{ color: "#7C3AED" }}>{avgScore}</p>
                <p className="text-xs font-medium" style={{ color: "#6B5B8A" }}>Avg score</p>
              </div>
            )}
          </div>

          {/* Sign out */}
          <button
            onClick={() => setShowSignOut(true)}
            className="mt-4 text-xs font-medium px-3 py-1 rounded-full"
            style={{ color: "#9CA3AF", background: "#F3F4F6" }}
          >
            Sign out
          </button>
        </div>

        {/* Divider */}
        <div className="h-px mx-4 mb-4" style={{ background: "#EDE8FA" }} />

        {/* Reviews */}
        <div>
          <h3 className="px-4 mb-3 font-black text-sm uppercase tracking-wide" style={{ color: "#B0A0CC" }}>Your Reviews</h3>
          {reviews.length === 0 ? (
            <div className="text-center py-12 px-8">
              <span className="text-4xl">🧋</span>
              <p className="mt-3 font-bold" style={{ color: "#12082A" }}>No reviews yet</p>
              <p className="text-sm mt-1 mb-4" style={{ color: "#6B5B8A" }}>Log your first boba to get started</p>
            </div>
          ) : (
            reviews.map((item, i) =>
              item.review ? (
                <ReviewCard key={item.review.id ?? i} review={item.review} currentUserId={userId} />
              ) : null
            )
          )}
        </div>
      </div>

      {/* Sign out modal */}
      {showSignOut && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowSignOut(false)}>
          <div className="w-full max-w-lg bg-white rounded-t-3xl p-6 pb-10" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-black mb-1" style={{ color: "#12082A" }}>Sign out?</h3>
            <p className="text-sm mb-6" style={{ color: "#6B5B8A" }}>You'll need to sign back in to access your account.</p>
            <div className="flex flex-col gap-3">
              <button onClick={handleSignOut} className="w-full py-3 rounded-2xl text-white font-bold" style={{ background: "#DC2626" }}>
                Sign out
              </button>
              <button onClick={() => setShowSignOut(false)} className="w-full py-3 rounded-2xl font-bold" style={{ background: "#F3EEFF", color: "#7C3AED" }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  )
}
