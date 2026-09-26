"use client"

import { useEffect, useState, type ReactNode } from "react"

export type ProfileTab = "cups" | "ranked" | "try" | "cafes"

/**
 * Profile sections that switch in place: every panel is rendered on the
 * server up front, so changing tabs doesn't reload the page (no loading
 * flash, no jump to the top). The URL still follows along (?tab=…) so a
 * shared link or a refresh opens the same tab.
 */
export default function ProfileTabs({ tabs, initial, base }: {
  tabs: { key: ProfileTab; label: string; panel: ReactNode }[]
  initial: ProfileTab
  base: string
}) {
  const [active, setActive] = useState<ProfileTab>(initial)
  const keys = tabs.map(t => t.key).join(",")

  // Back/forward across a tab change made elsewhere (e.g. a ?tab= link).
  useEffect(() => {
    const sync = () => {
      const t = new URLSearchParams(window.location.search).get("tab") as ProfileTab | null
      setActive(t && keys.split(",").includes(t) ? t : "cups")
    }
    window.addEventListener("popstate", sync)
    return () => window.removeEventListener("popstate", sync)
  }, [keys])

  const select = (key: ProfileTab) => {
    setActive(key)
    window.history.replaceState(window.history.state, "", key === "cups" ? base : `${base}?tab=${key}`)
  }
  const current = tabs.find(t => t.key === active) ?? tabs[0]

  return (
    <>
      <div role="tablist" aria-label="Profile sections" style={{ display: "grid", gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))`, margin: "14px 0 2px" }}>
        {tabs.map(t => (
          <button key={t.key} type="button" role="tab" aria-selected={active === t.key} onClick={() => select(t.key)}
            style={{
              height: 44, background: "none", border: "none", cursor: "pointer", fontSize: 14,
              fontWeight: active === t.key ? 600 : 400, color: active === t.key ? "var(--c-ink)" : "var(--c-mid)",
              borderBottom: active === t.key ? "2px solid var(--c-jade)" : "1px solid var(--c-rule)",
            }}>
            {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" aria-label={current?.label}>{current?.panel}</div>
    </>
  )
}
