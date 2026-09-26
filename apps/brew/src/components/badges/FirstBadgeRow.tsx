import { FIRST_BADGES } from "@niche/database"

/** First-reviewer badges: the whole ladder, earned ones filled, the rest dashed. */
export default function FirstBadgeRow({ count, nowrap = false, show = "all" }: {
  count: number
  nowrap?: boolean
  /** "all": the whole ladder; "next": earned plus the next one; "earned": earned only. */
  show?: "all" | "next" | "earned"
}) {
  const nextAt = FIRST_BADGES.find(b => count < b.at)?.at
  const badges = FIRST_BADGES.filter(b => show === "all" || count >= b.at || (show === "next" && b.at === nextAt))
  return (
    <ul aria-label="First-reviewer badges" style={{ listStyle: "none", display: "flex", flexWrap: nowrap ? "nowrap" : "wrap", gap: 6, padding: 0, margin: 0 }}>
      {badges.map(b => {
        const have = count >= b.at
        return (
          <li key={b.name} aria-label={`${b.name}, first at ${b.at} ${b.at === 1 ? "café" : "cafés"}${have ? ", earned" : ""}`}
            style={{
              fontSize: 12, padding: "4px 10px", borderRadius: 999, whiteSpace: "nowrap", flexShrink: 0,
              background: have ? "var(--c-ink)" : "transparent", color: have ? "var(--c-paper)" : "var(--c-mid)",
              border: have ? "1px solid var(--c-ink)" : "1px dashed var(--c-rule)",
            }}>
            {b.name} <span aria-hidden="true" style={{ opacity: 0.7 }}>{b.at}</span>
          </li>
        )
      })}
    </ul>
  )
}
