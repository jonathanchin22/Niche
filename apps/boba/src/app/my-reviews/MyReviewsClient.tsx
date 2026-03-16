"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@niche/auth/client"
import { updateReviewScore } from "@niche/database"
import { AppShell } from "@/components/ui/AppShell"
import Link from "next/link"

interface Review {
  id: string
  item_name: string | null
  score: number
  note: string | null
  tags: string[]
  created_at: string
  place?: { id: string; name: string; city: string; state: string } | null
}

type SortKey = "score" | "date" | "place"
type SortDir = "desc" | "asc"

// ─── Partial-fill star display ────────────────────────────────────────────────
function StarRow({ score, size = 12 }: { score: number; size?: number }) {
  const scoreNum = Number(score)
  const pct = Number.isFinite(scoreNum) ? Math.max(0, Math.min(1, scoreNum / 10)) : 0
  return (
    <div style={{ display: "flex", gap: 2 }}>
      {[0, 1, 2, 3, 4].map(i => {
        const fill = Number.isFinite(pct) ? Math.max(0, Math.min(1, pct * 5 - i)) : 0
        const offset = `${Math.max(0, Math.min(100, fill * 100))}%`
        const gid = `mr-${i}-${Math.round(scoreNum * 10)}-${size}`
        return (
          <svg key={i} width={size} height={size} viewBox="0 0 24 24">
            <defs><linearGradient id={gid}><stop offset={offset} stopColor="#c9a84c" /><stop offset={offset} stopColor="#e8e8e4" /></linearGradient></defs>
            <path d="M12 2l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17l-5.9 3 1.2-6.5L2.5 9l6.6-.9z" fill={`url(#${gid})`} />
          </svg>
        )
      })}
    </div>
  )
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return "today"
  if (days === 1) return "yesterday"
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months}mo ago`
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", year: "numeric" })
}

// ─── Drag handle icon (6 dots) ────────────────────────────────────────────────
function DragHandle() {
  return (
    <svg width="14" height="18" viewBox="0 0 14 18" fill="none" style={{ flexShrink: 0 }}>
      {[0, 6, 12].map(y =>
        [0, 6].map(x => (
          <circle key={`${x}-${y}`} cx={2 + x} cy={3 + y} r="1.5" fill="#ccc" />
        ))
      )}
    </svg>
  )
}

// ─── Score badge ──────────────────────────────────────────────────────────────
function ScoreBadge({ score, isUpdating }: { score: number; isUpdating: boolean }) {
  return (
    <div style={{
      minWidth: 44, height: 44,
      background: isUpdating ? "#e8f4ee" : "white",
      border: `1.5px solid ${isUpdating ? "#2d6a4f" : "#e8e8e4"}`,
      borderRadius: 10,
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      transition: "all 0.2s",
      flexShrink: 0,
    }}>
      <span style={{
        fontFamily: "'DM Serif Display', Georgia, serif",
        fontSize: 15, color: isUpdating ? "#2d6a4f" : "#1a1a1a",
        lineHeight: 1, fontWeight: 400,
        transition: "color 0.2s",
      }}>
        {score.toFixed(1)}
      </span>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export function MyReviewsClient({ userId, initialReviews }: { userId: string; initialReviews: Review[] }) {
    // Touch drag state
    const touchDragId = useRef<string | null>(null)
    const touchOverId = useRef<string | null>(null)
    const [touchDragging, setTouchDragging] = useState<string | null>(null)
    const [touchDragOver, setTouchDragOver] = useState<string | null>(null)

    // Helper to get review id from touch location
    // Accepts either DOM Touch or React.Touch (they are structurally compatible for clientX/clientY)
    const getReviewIdFromTouch = (touch: Touch | React.Touch) => {
      const elem = document.elementFromPoint(touch.clientX, touch.clientY)
      if (!elem) return null
      let node = elem as HTMLElement | null
      while (node && !node.dataset.reviewId) {
        node = node.parentElement
      }
      return node?.dataset.reviewId || null
    }

    // Touch event handlers
    const handleTouchStart = (e: React.TouchEvent, reviewId: string) => {
      if (e.touches.length !== 1) return
      touchDragId.current = reviewId
      setTouchDragging(reviewId)
      setTouchDragOver(reviewId)
      touchOverId.current = reviewId
    }

    const handleTouchMove = (e: React.TouchEvent) => {
      if (!touchDragId.current) return
      const touch = e.touches[0]
      if (!touch) return
      // React.Touch is structurally compatible for clientX/clientY, but not a DOM Touch, so cast as needed
      const overId = getReviewIdFromTouch(touch as unknown as Touch)
      if (overId && overId !== touchOverId.current) {
        touchOverId.current = overId
        setTouchDragOver(overId)
      }
    }

    const handleTouchEnd = () => {
      const fromId = touchDragId.current
      const dropId = touchOverId.current
      if (!fromId || !dropId || fromId === dropId) {
        setTouchDragging(null); setTouchDragOver(null)
        touchDragId.current = null; touchOverId.current = null
        return
      }
      const fromIndex = reviews.findIndex(r => r.id === fromId)
      const dropIndex = reviews.findIndex(r => r.id === dropId)
      if (fromIndex === -1 || dropIndex === -1 || fromIndex === dropIndex) {
        setTouchDragging(null); setTouchDragOver(null)
        touchDragId.current = null; touchOverId.current = null
        return
      }
      // Reorder the master reviews array
      const newReviews = [...reviews]
      const [moved] = newReviews.splice(fromIndex, 1)
      if (!moved) return
      newReviews.splice(dropIndex, 0, moved)
      // Only update the score of the dragged item to match the drop target
      const dropTargetScore = reviews[dropIndex]?.score ?? moved.score
      const updated = newReviews.map(r =>
        r.id === fromId ? { ...r, score: dropTargetScore } : r
      )
      // Find which review actually changed score
      const originalScores = new Map(reviews.map(r => [r.id, r.score]))
      const changed: { review_id: string; score: number }[] = []
      updated.forEach(r => {
        const originalScore = originalScores.get(r.id)
        if (originalScore === undefined) return
        if (r.score !== originalScore) {
          changed.push({ review_id: r.id, score: r.score })
        }
      })
      setReviews(updated)
      if (changed.length > 0) {
        setUpdatingIds(prev => {
          const s = new Set(prev)
          changed.forEach(c => s.add(c.review_id))
          return s
        })
        changed.forEach(c => saveScore(c))
      }
      setTouchDragging(null); setTouchDragOver(null)
      touchDragId.current = null; touchOverId.current = null
    }

    const handleTouchCancel = () => {
      setTouchDragging(null); setTouchDragOver(null)
      touchDragId.current = null; touchOverId.current = null
    }
  const supabase = createClient()
  const queryClient = useQueryClient()

  // Local ordered list — this is what we actually render + drag
  const [reviews, setReviews] = useState<Review[]>(() =>
    [...(initialReviews ?? [])].sort((a, b) => b.score - a.score)
  )
  const [search, setSearch] = useState("")
  const [sortKey, setSortKey] = useState<SortKey>("score")
  const [sortDir, setSortDir] = useState<SortDir>("desc")
  const [filterMin, setFilterMin] = useState(0)
  const [updatingIds, setUpdatingIds] = useState<Set<string>>(new Set())

  // Drag state (track review IDs to avoid stale index issues)
  const dragId = useRef<string | null>(null)
  const dragOverId = useRef<string | null>(null)
  const [dragging, setDragging] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState<string | null>(null)

  // Mutation for persisting score changes
  const { mutate: saveScore } = useMutation({
    mutationFn: ({ review_id, score }: { review_id: string; score: number }) =>
      updateReviewScore(supabase as any, { review_id, score }),
    onSettled: (_, __, vars) => {
      setUpdatingIds(prev => { const s = new Set(prev); s.delete(vars.review_id); return s })
    },
  })

  // ── Sorting + filtering (applied to a copy, not the drag order) ──────────
  const filtered = reviews.filter(r => {
    if (r.score < filterMin) return false
    if (!search) return true
    const q = search.toLowerCase()
    return (
      r.item_name?.toLowerCase().includes(q) ||
      r.place?.name?.toLowerCase().includes(q) ||
      r.note?.toLowerCase().includes(q) ||
      r.tags?.some(t => t.toLowerCase().includes(q))
    )
  })

  // When in score sort mode, use the user's drag order (which defines sub-rankings)
  // Otherwise sort by the chosen key
  const sorted = sortKey === "score"
    ? [...filtered].sort((a, b) => {
        const diff = sortDir === "desc" ? b.score - a.score : a.score - b.score
        if (diff !== 0) return diff
        // Same score — preserve drag order from reviews array
        return reviews.indexOf(a) - reviews.indexOf(b)
      })
    : [...filtered].sort((a, b) => {
        let va: string | number = 0
        let vb: string | number = 0
        if (sortKey === "date") { va = a.created_at; vb = b.created_at }
        if (sortKey === "place") { va = a.place?.name ?? ""; vb = b.place?.name ?? "" }
        if (typeof va === "string") return sortDir === "desc" ? (vb as string).localeCompare(va as string) : (va as string).localeCompare(vb as string)
        return sortDir === "desc" ? (vb as number) - (va as number) : (va as number) - (vb as number)
      })

  // ── Drag handlers ─────────────────────────────────────────────────────────
  const handleDragStart = useCallback((e: React.DragEvent, reviewId: string) => {
    const idx = reviews.findIndex(r => r.id === reviewId)
    if (idx === -1) return
    dragId.current = reviewId
    setDragging(reviewId)
    e.dataTransfer.effectAllowed = "move"
  }, [reviews])

  const handleDragOver = useCallback((e: React.DragEvent, reviewId: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
    const idx = reviews.findIndex(r => r.id === reviewId)
    if (idx === -1) return
    if (dragOverId.current !== reviewId) {
      dragOverId.current = reviewId
      setDragOver(reviewId)
    }
  }, [reviews])

  const handleDrop = useCallback((e: React.DragEvent, dropReviewId: string) => {
    e.preventDefault()
    const fromId = dragId.current
    if (!fromId || fromId === dropReviewId) {
      setDragging(null); setDragOver(null)
      dragId.current = null; dragOverId.current = null
      return
    }

    const fromIndex = reviews.findIndex(r => r.id === fromId)
    const dropIndex = reviews.findIndex(r => r.id === dropReviewId)
    if (fromIndex === -1 || dropIndex === -1 || fromIndex === dropIndex) {
      setDragging(null); setDragOver(null)
      dragId.current = null; dragOverId.current = null
      return
    }

    // Reorder the master reviews array
    const newReviews = [...reviews]
    const [moved] = newReviews.splice(fromIndex, 1)
    if (!moved) return
    newReviews.splice(dropIndex, 0, moved)

    // Only update the score of the dragged item to match the drop target
    const dropTarget = reviews[dropIndex]
    if (!dropTarget) {
      setDragging(null); setDragOver(null)
      dragId.current = null; dragOverId.current = null
      return
    }
    const dropTargetScore = dropTarget.score
    const updated = newReviews.map(r =>
      r.id === fromId ? { ...r, score: dropTargetScore } : r
    )

    // Find which review actually changed score
    const originalScores = new Map(reviews.map(r => [r.id, r.score]))
    const changed: { review_id: string; score: number }[] = []
    updated.forEach(r => {
      const originalScore = originalScores.get(r.id)
      if (originalScore === undefined) return
      if (r.score !== originalScore) {
        changed.push({ review_id: r.id, score: r.score })
      }
    })

    setReviews(updated)

    // Persist changed score
    if (changed.length > 0) {
      setUpdatingIds(prev => {
        const s = new Set(prev)
        changed.forEach(c => s.add(c.review_id))
        return s
      })
      changed.forEach(c => saveScore(c))
    }

    setDragging(null); setDragOver(null)
    dragId.current = null; dragOverId.current = null
  }, [reviews, saveScore])

  const handleDragEnd = useCallback(() => {
    setDragging(null); setDragOver(null)
    dragId.current = null; dragOverId.current = null
  }, [])

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === "desc" ? "asc" : "desc")
    else { setSortKey(key); setSortDir("desc") }
  }

  const sortIcon = (key: SortKey) => sortKey === key ? (sortDir === "desc" ? " ↓" : " ↑") : ""

  // ── Map from sorted display index back to master reviews index ────────────
  const masterIndexOf = (r: Review) => reviews.findIndex(x => x.id === r.id)

  return (
    <AppShell activeTab="profile">
      <style>{`
        .mr-card { transition: opacity 0.15s, transform 0.15s, box-shadow 0.15s; }
        .mr-card.dragging { opacity: 0.4; }
        .mr-card.drag-over { transform: translateY(-2px); box-shadow: 0 4px 16px rgba(45,106,79,0.12); }
        .mr-handle { cursor: grab; touch-action: none; }
        .mr-handle:active { cursor: grabbing; }
        .mr-chip { transition: background 0.12s, color 0.12s, border-color 0.12s; }
      `}</style>
      <div style={{ padding: "52px 0 24px" }}>

        {/* Header */}
        <div style={{ padding: "0 28px 20px" }}>
          <Link href="/profile" style={{ textDecoration: "none" }}>
            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "#888", margin: "0 0 12px" }}>← profile</p>
          </Link>
          <p style={{ fontFamily: "cursive", fontSize: 15, color: "#888", margin: "0 0 4px" }}>
            your taste, ranked
          </p>
          <h1 style={{
            fontFamily: "'DM Serif Display', Georgia, serif",
            fontSize: 30, color: "#1a1a1a", margin: "0 0 4px", fontWeight: 400,
          }}>
            my reviews
          </h1>
          <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "#bbb", margin: 0 }}>
            {reviews.length} drink{reviews.length !== 1 ? "s" : ""} logged
          </p>
        </div>

        {/* Search */}
        <div style={{ padding: "0 28px 16px" }}>
          <div style={{
            display: "flex", alignItems: "center",
            border: "1px solid #e8e8e4", borderRadius: 10,
            padding: "10px 14px", background: "white", gap: 8,
          }}>
            <span style={{ color: "#bbb", fontSize: 13 }}>◎</span>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="search drinks, shops, notes..."
              style={{
                flex: 1, border: "none", outline: "none", background: "transparent",
                fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: "#1a1a1a",
              }}
            />
            {search && (
              <button onClick={() => setSearch("")} style={{ background: "none", border: "none", cursor: "pointer", color: "#bbb", fontSize: 16, padding: 0, lineHeight: 1 }}>×</button>
            )}
          </div>
        </div>

        {/* Sort + Filter bar */}
        <div style={{ padding: "0 28px 16px", display: "flex", gap: 8, overflowX: "auto", alignItems: "center" }}>
          {(["score", "date", "place"] as SortKey[]).map(key => (
            <button key={key} onClick={() => toggleSort(key)}
              className="mr-chip"
              style={{
                fontFamily: "'DM Sans', sans-serif", fontSize: 12,
                padding: "6px 14px", borderRadius: 20, whiteSpace: "nowrap",
                border: `1px solid ${sortKey === key ? "#2d6a4f" : "#e8e8e4"}`,
                background: sortKey === key ? "#e8f4ee" : "transparent",
                color: sortKey === key ? "#2d6a4f" : "#888",
                cursor: "pointer",
              }}
            >
              {key}{sortIcon(key)}
            </button>
          ))}

          {/* Min score filter */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: 4, flexShrink: 0 }}>
            <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: "#bbb", whiteSpace: "nowrap" }}>
              min
            </span>
            <select
              value={filterMin}
              onChange={e => setFilterMin(Number(e.target.value))}
              style={{
                fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "#888",
                border: "1px solid #e8e8e4", borderRadius: 20, padding: "4px 10px",
                background: "transparent", outline: "none", cursor: "pointer",
              }}
            >
              {[0, 5, 6, 7, 7.5, 8, 8.5, 9, 9.5].map(v => (
                <option key={v} value={v}>{v === 0 ? "all" : v.toFixed(1) + "+"}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Drag hint — only show when sorted by score */}
        {sortKey === "score" && sorted.length > 1 && (
          <div style={{ padding: "0 28px 12px" }}>
            <p style={{
              fontFamily: "cursive", fontSize: 13, color: "#bbb",
              margin: 0, display: "flex", alignItems: "center", gap: 6,
            }}>
              <DragHandle />
              drag to rerank — score updates automatically
            </p>
          </div>
        )}

        {/* Review list */}
        {sorted.length === 0 ? (
          <div style={{ padding: "40px 28px", textAlign: "center" }}>
            <p style={{ fontFamily: "cursive", fontSize: 17, color: "#bbb" }}>
              {search ? `nothing matches "${search}"` : "no reviews yet — go log a drink!"}
            </p>
            {!search && (
              <Link href="/log">
                <button style={{
                  marginTop: 12, fontFamily: "'DM Sans', sans-serif", fontSize: 13,
                  background: "#2d6a4f", color: "#fff", border: "none",
                  borderRadius: 8, padding: "10px 20px", cursor: "pointer",
                }}>
                  log a drink
                </button>
              </Link>
            )}
          </div>
        ) : (
          <div style={{ padding: "0 16px", display: "flex", flexDirection: "column", gap: 8 }}>
            {sorted.map((review, displayIndex) => {
              const isDragging = dragging === review.id
              const isDragOver = dragOver === review.id
              const isUpdating = updatingIds.has(review.id)
              const canDrag = sortKey === "score" && !search

              const isTouchDragging = touchDragging === review.id
              const isTouchDragOver = touchDragOver === review.id
              return (
                <div
                  key={review.id}
                  data-review-id={review.id}
                  className={`mr-card${isDragging ? " dragging" : ""}${isDragOver ? " drag-over" : ""}${isTouchDragging ? " dragging" : ""}${isTouchDragOver ? " drag-over" : ""}`}
                  draggable={canDrag}
                  onDragStart={canDrag ? e => handleDragStart(e, review.id) : undefined}
                  onDragOver={canDrag ? e => handleDragOver(e, review.id) : undefined}
                  onDrop={canDrag ? e => handleDrop(e, review.id) : undefined}
                  onDragEnd={canDrag ? handleDragEnd : undefined}
                  onTouchStart={canDrag ? e => handleTouchStart(e, review.id) : undefined}
                  onTouchMove={canDrag ? handleTouchMove : undefined}
                  onTouchEnd={canDrag ? handleTouchEnd : undefined}
                  onTouchCancel={canDrag ? handleTouchCancel : undefined}
                  style={{
                    background: "white",
                    border: `1px solid ${isDragOver || isTouchDragOver ? "#2d6a4f40" : "#e8e8e4"}`,
                    borderRadius: 12,
                    padding: "14px 16px",
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    userSelect: "none",
                    touchAction: canDrag ? "none" : undefined,
                  }}
                >
                  {/* Drag handle */}
                  {canDrag && (
                    <div className="mr-handle" style={{ opacity: 0.5, padding: "0 2px" }}>
                      <DragHandle />
                    </div>
                  )}

                  {/* Rank number */}
                  <span style={{
                    fontFamily: "'DM Serif Display', Georgia, serif",
                    fontSize: 13, color: "#ccc", minWidth: 20,
                    textAlign: "right", flexShrink: 0,
                  }}>
                    {displayIndex + 1}
                  </span>

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{
                      fontFamily: "'DM Serif Display', Georgia, serif",
                      fontSize: 16, margin: "0 0 2px", color: "#1a1a1a",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>
                      {review.item_name?.trim() ? review.item_name : "drink"}
                    </p>
                    <p style={{
                      fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "#888",
                      margin: "0 0 4px",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>
                      {review.place?.name ?? "unknown shop"}{review.place?.city ? ` · ${review.place.city}` : ""}
                    </p>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <StarRow score={review.score} size={11} />
                      <span suppressHydrationWarning style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 10, color: "#bbb" }}>
                        {timeAgo(review.created_at)}
                      </span>
                    </div>
                    {review.note && (
                      <p style={{
                        fontFamily: "cursive", fontSize: 14, color: "#888",
                        margin: "6px 0 0",
                        overflow: "hidden", textOverflow: "ellipsis",
                        display: "-webkit-box", WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical" as any,
                      }}>
                        {review.note}
                      </p>
                    )}
                  </div>

                  {/* Score badge */}
                  <ScoreBadge score={review.score} isUpdating={isUpdating} />
                </div>
              )
            })}

            {/* Bottom padding */}
            <div style={{ height: 8 }} />
          </div>
        )}
      </div>
    </AppShell>
  )
}
