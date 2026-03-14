"use client"

import { useState, useEffect } from "react"
import { getReviewVotes, voteReview, getReviewComments, addReviewComment } from "@niche/database"
import type { Review, ReviewComment } from "@niche/shared-types"
import { MonoLabel } from "@/components/ui/Primitives"

interface ReviewDetailModalProps {
  review: Review
  currentUserId: string
  onClose: () => void
}

export default function ReviewDetailModal({ review, currentUserId, onClose }: ReviewDetailModalProps) {
  const [upvotes, setUpvotes] = useState(review.upvotes_count ?? 0)
  const [downvotes, setDownvotes] = useState(review.downvotes_count ?? 0)
  const [userVote, setUserVote] = useState(review.user_vote ?? 0)
  const [comments, setComments] = useState<ReviewComment[]>([])
  const [commentText, setCommentText] = useState("")
  const [isVoting, setIsVoting] = useState(false)
  const [isCommenting, setIsCommenting] = useState(false)

  useEffect(() => {
    // Fetch latest votes and comments
    async function fetchVotesAndComments() {
      const { upvotes, downvotes, user_vote } = await getReviewVotes(undefined, { review_id: review.id, user_id: currentUserId })
      setUpvotes(upvotes)
      setDownvotes(downvotes)
      setUserVote(user_vote)
      const comments = await getReviewComments(undefined, { review_id: review.id })
      setComments(comments)
    }
    fetchVotesAndComments()
  }, [review.id, currentUserId])

  const handleVote = async (vote: 1 | -1) => {
    if (isVoting) return
    setIsVoting(true)
    if (userVote === vote) {
      // Undo vote
      if (vote === 1) setUpvotes(u => u - 1)
      if (vote === -1) setDownvotes(d => d - 1)
      setUserVote(0)
      await voteReview(undefined, { review_id: review.id, user_id: currentUserId, vote: 0 })
    } else {
      if (vote === 1) {
        setUpvotes(u => userVote === -1 ? u + 1 : u + (userVote === 0 ? 1 : 0))
        if (userVote === -1) setDownvotes(d => d - 1)
      } else {
        setDownvotes(d => userVote === 1 ? d + 1 : d + (userVote === 0 ? 1 : 0))
        if (userVote === 1) setUpvotes(u => u - 1)
      }
      setUserVote(vote)
      await voteReview(undefined, { review_id: review.id, user_id: currentUserId, vote })
    }
    setIsVoting(false)
  }

  const handleAddComment = async () => {
    if (!commentText.trim()) return
    setIsCommenting(true)
    await addReviewComment(undefined, { review_id: review.id, user_id: currentUserId, body: commentText.trim() })
    setCommentText("")
    const comments = await getReviewComments(undefined, { review_id: review.id })
    setComments(comments)
    setIsCommenting(false)
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 300, overflowY: "auto", maxWidth: 430, margin: "0 auto" }}>
      <div style={{ background: "#fff", borderRadius: 12, margin: 32, padding: 24, boxShadow: "0 2px 16px rgba(0,0,0,0.12)" }}>
        <button onClick={onClose} style={{ float: "right", background: "none", border: "none", fontSize: 18, cursor: "pointer" }}>✕</button>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: 28, margin: "0 0 8px" }}>{review.item_name ?? review.category ?? "brew"}</h2>
        <MonoLabel>{review.place?.name}</MonoLabel>
        <div style={{ margin: "16px 0" }}>
          <span style={{ fontFamily: "var(--font-hand)", fontSize: 18, color: "#333" }}>{review.note}</span>
        </div>
        <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
          <button type="button" onClick={() => handleVote(1)} disabled={isVoting} style={{ background: userVote === 1 ? "#e8f4ee" : "#fff", color: userVote === 1 ? "#2d6a4f" : "#888", border: "1px solid #e8e8e4", borderRadius: 6, padding: "2px 8px", fontWeight: 600, cursor: "pointer" }}>▲ {upvotes}</button>
          <button type="button" onClick={() => handleVote(-1)} disabled={isVoting} style={{ background: userVote === -1 ? "#fbeee6" : "#fff", color: userVote === -1 ? "#c0392b" : "#888", border: "1px solid #e8e8e4", borderRadius: 6, padding: "2px 8px", fontWeight: 600, cursor: "pointer" }}>▼ {downvotes}</button>
        </div>
        <div style={{ margin: "24px 0 12px" }}>
          <h3 style={{ fontFamily: "var(--font-display)", fontSize: 18, margin: 0 }}>Comments</h3>
          <div style={{ margin: "12px 0" }}>
            {comments.length === 0 && <MonoLabel style={{ color: "#bbb" }}>No comments yet.</MonoLabel>}
            {comments.map(c => (
              <div key={c.id} style={{ marginBottom: 12, padding: 10, background: "#f8f8f8", borderRadius: 6 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  {c.user?.avatar_url && <img src={c.user.avatar_url} alt="" style={{ width: 22, height: 22, borderRadius: "50%" }} />}
                  <MonoLabel style={{ fontSize: 12 }}>@{c.user?.username ?? "user"}</MonoLabel>
                </div>
                <div style={{ fontFamily: "var(--font-hand)", fontSize: 15, color: "#333" }}>{c.body}</div>
                <MonoLabel style={{ fontSize: 10, color: "#bbb" }}>{new Date(c.created_at).toLocaleString()}</MonoLabel>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <input
              type="text"
              value={commentText}
              onChange={e => setCommentText(e.target.value)}
              placeholder="Add a comment..."
              style={{ flex: 1, fontFamily: "var(--font-display)", fontSize: 15, border: "1px solid #e8e8e4", borderRadius: 6, padding: "8px 10px" }}
              disabled={isCommenting}
            />
            <button type="button" onClick={handleAddComment} disabled={isCommenting || !commentText.trim()} style={{ background: "var(--c-accent)", color: "#fff", border: "none", borderRadius: 6, padding: "8px 16px", fontFamily: "var(--font-mono)", fontSize: 13, cursor: "pointer", opacity: isCommenting || !commentText.trim() ? 0.6 : 1 }}>Post</button>
          </div>
        </div>
      </div>
    </div>
  )
}
