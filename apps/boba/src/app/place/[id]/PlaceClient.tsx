"use client"

import { useRouter } from "next/navigation"
import { ReviewCard } from "@/components/feed/ReviewCard"
import { AppShell } from "@/components/ui/AppShell"
import Link from "next/link"

interface PlaceClientProps {
  place: any
  reviews: any[]
  userId: string
}

export default function PlaceClient({ place, reviews, userId }: PlaceClientProps) {
  const router = useRouter()
  const scoreColor = place.avg_score >= 8 ? "#059669" : place.avg_score >= 6 ? "#D97706" : "#9CA3AF"

  return (
    <AppShell activeTab="explore">
      <div className="pb-6">
        {/* Back button */}
        <div className="px-4 pt-4 mb-2">
          <button onClick={() => router.back()} className="flex items-center gap-1.5 text-sm font-medium" style={{ color: "#7C3AED" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="m15 18-6-6 6-6"/>
            </svg>
            Back
          </button>
        </div>

        {/* Place header */}
        <div className="px-4 pb-4">
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-purple-50">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex-1">
                <h1 className="text-xl font-black" style={{ color: "#12082A" }}>{place.name}</h1>
                {place.address && (
                  <p className="text-sm mt-0.5" style={{ color: "#6B5B8A" }}>{place.address}</p>
                )}
              </div>
              {place.avg_score > 0 && (
                <div className="w-14 h-14 rounded-full flex items-center justify-center text-white font-black text-lg flex-shrink-0" style={{ background: scoreColor }}>
                  {place.avg_score?.toFixed(1)}
                </div>
              )}
            </div>
            <div className="flex items-center gap-4 mt-3">
              <span className="text-xs font-medium" style={{ color: "#B0A0CC" }}>
                {place.review_count ?? reviews.length} {place.review_count === 1 ? "review" : "reviews"}
              </span>
              <Link
                href={`/log?place_id=${place.id}&place_name=${encodeURIComponent(place.name)}`}
                className="ml-auto px-4 py-1.5 rounded-full text-xs font-bold text-white"
                style={{ background: "#7C3AED" }}
              >
                Log a visit
              </Link>
            </div>
          </div>
        </div>

        {/* Reviews */}
        <h3 className="px-4 mb-3 font-black text-sm uppercase tracking-wide" style={{ color: "#B0A0CC" }}>
          Reviews
        </h3>
        {reviews.length === 0 ? (
          <div className="text-center py-12 px-8">
            <span className="text-4xl">🧋</span>
            <p className="mt-3 font-bold" style={{ color: "#12082A" }}>No reviews yet</p>
            <p className="text-sm mt-1 mb-4" style={{ color: "#6B5B8A" }}>Be the first to log this spot!</p>
            <Link href={`/log`} className="px-4 py-2 rounded-full text-sm font-bold text-white" style={{ background: "#7C3AED" }}>
              Log a drink
            </Link>
          </div>
        ) : (
          reviews.map((item: any, i: number) =>
            item.review ? (
              <ReviewCard key={item.review.id ?? i} review={item.review} currentUserId={userId} />
            ) : null
          )
        )}
      </div>
    </AppShell>
  )
}
