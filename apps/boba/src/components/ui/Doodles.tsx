// Hand-drawn doodles: one ink stroke plus one milk-tea shadow offset 5px, like a
// print slightly off register. At most one per screen — loading, empty states
// and the hero of a cup without a photo. Never next to a real photo.

import type { ReactNode } from "react"

const INK = "var(--c-ink)"
const TEA = "var(--c-tint)"

function Doodle({ size = 120, shadow, children }: { size?: number; shadow?: string; children: ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" fill="none" aria-hidden="true">
      {shadow && <path d={shadow} fill={TEA} transform="translate(5 5)" />}
      <g stroke={INK} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{children}</g>
    </svg>
  )
}

function Pearls({ bob = false, y = 92 }: { bob?: boolean; y?: number }) {
  const pearls = [[48, y], [60, y + 3], [72, y], [54, y - 9], [67, y - 8]]
  return (
    <g fill={INK} stroke="none">
      {pearls.map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r="4.2" className={bob ? `bob ${i % 3 === 1 ? "bob-2" : i % 3 === 2 ? "bob-3" : ""}` : undefined} />
      ))}
    </g>
  )
}

/** Milk tea with a dome lid, straw and pearls — the boba! mascot. */
export function BobaCup({ size, animated = false }: { size?: number; animated?: boolean }) {
  return (
    <Doodle size={size} shadow="M36 38 L43 104 Q60 109 77 104 L84 38 Z">
      <path d="M35 37 L43 104 Q60 109.5 77 104 L85 37" />
      <path d="M31 37.5 L89 36.5" />
      <path d="M35 37 Q60 18 85 37" />
      <path d="M66 4 L60 30" />
      <path d="M40 62 Q60 67 81 61" />
      <Pearls bob={animated} />
    </Doodle>
  )
}

/** A clear fruit tea with a citrus slice on the rim. */
export function FruitTea({ size }: { size?: number }) {
  return (
    <Doodle size={size} shadow="M36 34 L42 104 Q60 109 78 104 L84 34 Z">
      <path d="M35 33 L42 104 Q60 109.5 78 104 L85 33" />
      <path d="M33 33.5 L87 32.5" />
      <path d="M76 33 A13 13 0 0 1 99 25" />
      <path d="M78 31 L96 26M84 32 L90 20" />
      <path d="M50 12 L57 60" />
      <path d="M48 52 L58 50 L60 60 L50 62 Z" />
      <path d="M62 66 L72 67 L71 77 L61 76 Z" />
    </Doodle>
  )
}

/** Matcha in a bowl with a whisk resting beside it. */
export function MatchaBowl({ size }: { size?: number }) {
  return (
    <Doodle size={size} shadow="M22 60 Q24 98 60 98 Q96 98 98 60 Z">
      <path d="M20 59.5 L100 60.5" />
      <path d="M22 60 Q24 98 60 98 Q96 98 98 61" />
      <path d="M46 102 L74 102" />
      <path d="M44 70 Q60 76 76 69" />
      <path d="M78 20 L70 48M82 22 L76 49M86 25 L82 50M73 47 Q79 54 84 50" />
    </Doodle>
  )
}

/** A sleepy tapioca pearl — empty states. */
export function SleepyPearl({ size }: { size?: number }) {
  return (
    <Doodle size={size} shadow="M60 34 Q90 36 92 62 Q92 92 60 94 Q30 92 30 62 Q30 36 60 34 Z">
      <path d="M60 34 Q90 36 92 62 Q92 92 60 94 Q30 92 30 62 Q30 37 58 34" />
      <path d="M44 48 Q50 42 58 42" opacity="0.6" />
      <path d="M47 64 Q51 69 55 64" />
      <path d="M65 64 Q69 69 73 64" />
      <path d="M56 76 Q60 79 64 76" />
      <path d="M86 30 L98 30 L86 42 L98 42" />
      <path d="M100 16 L108 16 L100 24 L108 24" />
    </Doodle>
  )
}

export function Sparkle({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="30 28 60 64" fill="none" aria-hidden="true">
      <path d="M60 30 Q62 56 88 60 Q62 64 60 90 Q58 64 32 60 Q58 56 60 30 Z" stroke="var(--c-jade)" strokeWidth="4" strokeLinejoin="round" />
    </svg>
  )
}

export function Underline({ width = 200 }: { width?: number }) {
  return (
    <svg width={width} height="14" viewBox="0 0 130 16" fill="none" preserveAspectRatio="none" aria-hidden="true">
      <path d="M3 10 Q20 3 38 9 T74 9 T110 8 Q120 7 127 5" stroke="var(--c-jade)" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

/** The doodle that stands in for a drink without a photo. */
export function DrinkDoodle({ category, itemName, size }: { category?: string | null; itemName?: string | null; size?: number }) {
  const text = `${category ?? ""} ${itemName ?? ""}`.toLowerCase()
  if (/matcha/.test(text)) return <MatchaBowl size={size} />
  if (/fruit|lemon|lychee|mango|passion|peach|grapefruit|jasmine/.test(text)) return <FruitTea size={size} />
  return <BobaCup size={size} />
}
