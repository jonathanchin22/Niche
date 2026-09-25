import Link from "next/link"
import type { CSSProperties, ReactNode } from "react"
import { formatScore } from "@/lib/brew"

// ─── MonoLabel ────────────────────────────────────────────────────────────────
export function MonoLabel({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <p className="t-label" style={style}>{children}</p>
}

// ─── Score ────────────────────────────────────────────────────────────────────
export function Score({ value, size = 38 }: { value: number | string; size?: number }) {
  return <span className="t-score" style={{ fontSize: size }}>{formatScore(value)}</span>
}

// ─── Avatar ───────────────────────────────────────────────────────────────────
export function Avatar({ user, size = 28 }: {
  user?: { username?: string | null; display_name?: string | null; avatar_url?: string | null } | null
  size?: number
}) {
  const initial = (user?.display_name || user?.username || "?")[0]?.toLowerCase()
  return (
    <span style={{
      width: size, height: size, borderRadius: size / 2, flexShrink: 0, overflow: "hidden",
      background: "var(--c-tint)", display: "inline-flex", alignItems: "center", justifyContent: "center",
      fontFamily: "var(--font-display)", fontSize: size * 0.55, color: "var(--c-mid)",
    }}>
      {user?.avatar_url
        ? <img src={user.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        : initial}
    </span>
  )
}

// ─── Page header ──────────────────────────────────────────────────────────────
export function PageTitle({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <header style={{ padding: "64px 24px 0", display: "flex", flexDirection: "column", gap: 8 }}>
      <h1 className="t-display" style={{ fontSize: 48 }}>{children}</h1>
      {sub}
    </header>
  )
}

export function SectionHeading({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, padding: "30px 24px 14px" }}>
      <h2 className="t-section">{children}</h2>
      {aside}
    </div>
  )
}

// ─── Icons (line, 1.5px) ──────────────────────────────────────────────────────
export function BackIcon() {
  return (
    <svg width="10" height="16" viewBox="0 0 10 16" fill="none" aria-hidden="true">
      <path d="M8 2 L2 8 L8 14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function CheersIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M3 6 L8 5 L9 12 Q9 15 6.5 15.4 Q4 15.6 3.5 13 Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M17 6 L12 5 L11 12 Q11 15 13.5 15.4 Q16 15.6 16.5 13 Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M10 1.5 V3.5M7 2.5 L7.8 3.8M13 2.5 L12.2 3.8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  )
}

export function BookmarkIcon({ filled = false }: { filled?: boolean }) {
  return (
    <svg width="16" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path d="M4 2 H14 V16 L9 12.5 L4 16 Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" fill={filled ? "currentColor" : "none"} />
    </svg>
  )
}

export function PlusIcon({ color = "currentColor", size = 16 }: { color?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M8 2v12M2 8h12" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

export function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.5" />
      <path d="M13.5 13.5 L17 17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

// ─── Search field ─────────────────────────────────────────────────────────────
export function SearchField({ id, label, value, onChange, placeholder }: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  placeholder: string
}) {
  return (
    <div style={{ position: "relative" }}>
      <label htmlFor={id} className="sr-only">{label}</label>
      <span style={{ position: "absolute", left: 16, top: 13, color: "var(--c-mid)" }}><SearchIcon /></span>
      <input
        id={id} type="search" value={value} placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        className="field" style={{ paddingLeft: 44 }}
      />
    </div>
  )
}

// ─── Cup tile: a review's photo, or a big-number score tile when there is none ─
// (Doodles stay one per screen, so grids never use them.)
export function CupTile({ review, height = "100%", chip = true, label }: {
  review: any
  height?: number | string
  chip?: boolean
  label?: string
}) {
  const photo = review.image_urls?.[0]
  const name = review.item_name ?? review.category ?? "a cup"
  return (
    <Link
      href={`/review/${review.id}`}
      aria-label={label ?? `${name}, ${formatScore(review.score)}`}
      style={{
        position: "relative", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4,
        height, overflow: "hidden", borderRadius: 2, padding: photo ? 0 : 8, textAlign: "center",
        background: photo ? "var(--c-tint)" : "var(--c-paper)",
      }}
    >
      {photo ? (
        <>
          <img src={photo} alt="" loading="lazy" className="photo" />
          {chip && <span className="chip">{formatScore(review.score)}</span>}
        </>
      ) : (
        <>
          <span className="t-display" style={{ fontSize: 44, lineHeight: 1 }}>{formatScore(review.score)}</span>
          <span className="t-label" style={{ letterSpacing: "0.1em", overflowWrap: "anywhere" }}>{name}</span>
        </>
      )}
    </Link>
  )
}
