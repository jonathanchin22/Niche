"use client"

import { track } from "@niche/analytics"
import { useState, useTransition } from "react"
import type { Review } from "@niche/shared-types"
import { createClient } from "@niche/auth/client"
import { setPersonalRank } from "@niche/database"
import { formatScore, isHomePlace, type Cup } from "@/lib/brew"

const MAX_QUESTIONS = 4

export interface NewCup { id: string; name: string; place: string; score: number; photo: string | null }

/** The rank value that slots a cup in at `index` of a best-first ladder. */
function rankAt(ladder: Review[], index: number, fallback: number) {
  const value = (r: Review | undefined) => (r ? Number(r.personal_rank ?? r.score) : undefined)
  const above = value(ladder[index - 1])
  const below = value(ladder[index])
  if (above != null && below != null) return (above + below) / 2
  if (above != null) return above - 1
  if (below != null) return below + 1
  return fallback
}

/**
 * "Which was better?" — a few head-to-head questions that binary-search the
 * new cup into the person's own ranking (the Beli mechanic). Skippable; the
 * 0–10 score stays as logged.
 */
export default function RankStep({ userId, cup, ladder, onDone }: {
  userId: string
  cup: NewCup
  ladder: Review[]
  onDone: (position: number | null) => void
}) {
  const [lo, setLo] = useState(0)
  const [hi, setHi] = useState(ladder.length)
  const [asked, setAsked] = useState(0)
  const [saving, startSaving] = useTransition()
  const mid = Math.floor((lo + hi) / 2)
  const rival = ladder[mid] as Cup | undefined

  const finish = (index: number) => startSaving(async () => {
    const personal_rank = rankAt(ladder, index, cup.score)
    await setPersonalRank(createClient(), { review_id: cup.id, user_id: userId, personal_rank }).catch(() => {})
    track("cup_ranked", { position: index + 1, of: ladder.length + 1, questions: asked + 1 })
    onDone(index + 1)
  })

  const settle = (nextLo: number, nextHi: number, nextAsked: number) => {
    if (nextLo >= nextHi) return finish(nextLo)
    if (nextAsked >= MAX_QUESTIONS) {
      // Out of questions: place it by score within what's left of the window.
      let index = nextLo
      while (index < nextHi && Number(ladder[index]?.score ?? 0) >= cup.score) index++
      return finish(index)
    }
    setLo(nextLo); setHi(nextHi); setAsked(nextAsked)
  }

  const pick = (choice: "new" | "old" | "same") => {
    if (choice === "same") return finish(mid)
    if (choice === "new") settle(lo, mid, asked + 1)
    else settle(mid + 1, hi, asked + 1)
  }

  if (!rival) return null
  const rivalName = rival.item_name ?? rival.category ?? "that cup"
  const rivalPlace = isHomePlace(rival.place) ? "at home" : rival.place?.name ?? ""
  const questions = Math.min(MAX_QUESTIONS, Math.ceil(Math.log2(ladder.length + 1)))

  return (
    <section aria-labelledby="rank-title" style={{ minHeight: "100svh", display: "flex", flexDirection: "column", padding: "44px 20px max(30px, env(safe-area-inset-bottom))" }}>
      <span className="t-label" style={{ textAlign: "center", letterSpacing: "0.16em" }}>
        ranking · {asked + 1} of {questions}
      </span>
      <h1 id="rank-title" className="t-display" style={{ fontSize: 40, textAlign: "center", margin: "18px 0 22px" }}>which was better?</h1>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Choice label="this one" name={cup.name} place={cup.place} score={cup.score} photo={cup.photo} disabled={saving} onPick={() => pick("new")} />
        <Choice label={`your #${mid + 1}`} name={rivalName} place={rivalPlace} score={Number(rival.score)} photo={rival.image_urls?.[0] ?? null} disabled={saving} onPick={() => pick("old")} />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: "auto", paddingTop: 28 }}>
        <button type="button" className="btn btn-secondary" disabled={saving} onClick={() => pick("same")}>about the same</button>
        <button type="button" className="t-label" disabled={saving} onClick={() => { track("cup_rank_skipped", { questions: asked }); onDone(null) }}
          style={{ minHeight: 44, background: "none", border: "none", cursor: "pointer" }}>skip for now</button>
      </div>
    </section>
  )
}

function Choice({ label, name, place, score, photo, disabled, onPick }: {
  label: string; name: string; place: string; score: number; photo: string | null; disabled: boolean; onPick: () => void
}) {
  return (
    <button type="button" onClick={onPick} disabled={disabled} aria-label={`${label}: ${name}${place ? `, ${place}` : ""}`}
      style={{ display: "flex", flexDirection: "column", gap: 8, padding: 0, textAlign: "left", background: "none", border: "none", cursor: "pointer" }}>
      {photo
        ? <img src={photo} alt="" className="photo" style={{ height: 210 }} />
        : (
          <span className="t-display" style={{ height: 210, width: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 64, background: "var(--c-paper)", border: "1px solid var(--c-rule)", borderRadius: 2 }}>
            {formatScore(score)}
          </span>
        )}
      <span className="t-label">{label}</span>
      <span className="t-title" style={{ fontSize: 22 }}>{name}</span>
      {place && <span className="t-meta" style={{ fontSize: 12, marginTop: -4 }}>{place}</span>}
    </button>
  )
}
