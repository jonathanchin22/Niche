// Hand-drawn doodles: one ink stroke plus one Oat shadow offset 5px, like a
// print slightly off register. Use at most one per screen, for loading,
// empty states and cups without a photo — never next to a real photo.

import type { ReactNode } from "react"

const INK = "var(--c-ink)"
const OAT = "var(--c-tint)"

function Doodle({ size = 120, shadow, children, stroke = 2 }: {
  size?: number
  shadow?: string
  children: ReactNode
  stroke?: number
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" fill="none" aria-hidden="true">
      {shadow && <path d={shadow} fill={OAT} transform="translate(5 5)" />}
      <g stroke={INK} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">{children}</g>
    </svg>
  )
}

export function SteamingCup({ size, animated = false }: { size?: number; animated?: boolean }) {
  return (
    <Doodle size={size} shadow="M30 58 Q29 90 44 97 Q60 102 77 96 Q89 89 88 57 Z">
      <path d="M28 56 Q27 90 42 97 Q60 103 77 96 Q90 88 89 55" />
      <path d="M25 55.5 Q58 50 92 54.5" />
      <path d="M88.5 64 Q102 63 101 75 Q100 86 86 86" />
      <path d="M16 104 Q60 113 104 102" />
      <path className={animated ? "steam" : undefined} d="M48 44 Q42 36 48 28 Q54 20 48 12" />
      <path className={animated ? "steam steam-late" : undefined} d="M65 42 Q71 34 65 26 Q59 19 65 12" />
    </Doodle>
  )
}

export function SleepyBean({ size }: { size?: number }) {
  return (
    <Doodle size={size} shadow="M60 34 Q90 36 92 62 Q92 92 60 94 Q30 92 30 62 Q30 36 60 34 Z">
      <path d="M60 34 Q90 36 92 62 Q92 92 60 94 Q30 92 30 62 Q30 37 58 34" />
      <path d="M47 62 Q51 67 55 62" />
      <path d="M65 62 Q69 67 73 62" />
      <path d="M56 74 Q60 77 64 74" />
      <path d="M86 30 L98 30 L86 42 L98 42" />
      <path d="M100 16 L108 16 L100 24 L108 24" />
    </Doodle>
  )
}

export function LatteTop({ size }: { size?: number }) {
  return (
    <Doodle size={size} shadow="M60 18 Q98 17 102 58 Q104 98 60 102 Q18 103 17 60 Q16 20 60 18 Z">
      <path d="M60 18 Q98 17 102 58 Q104 98 60 102 Q18 103 17 60 Q16 21 57 18" />
      <path d="M60 32 Q88 31 89 60 Q89 88 60 89 Q32 90 31 60 Q30 34 58 32" />
      <path d="M60 73 Q43 61 49 52 Q55 46 60 55 Q65 46 71 52 Q77 61 60 73" />
      <path d="M103 55 Q113 55 112 61 Q111 67 102 66" />
    </Doodle>
  )
}

export function PourOver({ size }: { size?: number }) {
  return (
    <Doodle size={size} shadow="M30 34 L90 34 Q84 46 72 60 L50 60 Q38 46 30 34 Z">
      <path d="M28 34 L92 33.5 Q85 46 72 60 L49 60 Q37 46 30 35" />
      <path d="M46 42 L52 56M60 41 L61 57M74 42 L69 56" />
      <path d="M45 66 Q34 80 38 96 Q42 104 60 104 Q78 104 82 96 Q86 80 75 66" />
      <path d="M43 64 L77 64.5" />
      <path d="M61 62 Q59 66 61 69" />
      <path d="M40 86 Q60 90 80 85" />
    </Doodle>
  )
}

export function IcedGlass({ size }: { size?: number }) {
  return (
    <Doodle size={size} shadow="M36 26 L42 100 Q60 106 78 100 L84 26 Z">
      <path d="M35 25 L42 100 Q60 106 78 100 L85 25" />
      <path d="M33 25.5 L87 24.5" />
      <path d="M46 44 L58 42 L60 54 L48 56 Z" />
      <path d="M60 58 L72 60 L70 72 L58 70 Z" />
      <path d="M68 10 L58 76" />
      <path d="M40 66 Q60 70 80 65" />
    </Doodle>
  )
}

export function MokaPot({ size }: { size?: number }) {
  return (
    <Doodle size={size} shadow="M40 62 L80 62 L88 98 L32 98 Z">
      <path d="M42 30 L78 30.5 L84 56 L36 56 Z" />
      <path d="M38 56 L40 62 L80 62 L82 56" />
      <path d="M40 62 L32 98 L88 98.5 L80 62" />
      <path d="M55 25 Q60 18 65 25" />
      <path d="M83 36 Q98 37 96 52 L85 53" />
      <path d="M42 31 L33 23" />
    </Doodle>
  )
}

export function Sparkle({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="30 28 60 64" fill="none" aria-hidden="true">
      <path d="M60 30 Q62 56 88 60 Q62 64 60 90 Q58 64 32 60 Q58 56 60 30 Z" stroke={INK} strokeWidth="4" strokeLinejoin="round" />
    </svg>
  )
}

export function Underline({ width = 200 }: { width?: number }) {
  return (
    <svg width={width} height="14" viewBox="0 0 130 16" fill="none" preserveAspectRatio="none" aria-hidden="true">
      <path d="M3 10 Q20 3 38 9 T74 9 T110 8 Q120 7 127 5" stroke={INK} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

/** The doodle that stands in for a cup without a photo, picked by what was drunk and where. */
export function DrinkDoodle({ category, itemName, atHome, size }: {
  category?: string | null
  itemName?: string | null
  atHome?: boolean
  size?: number
}) {
  const text = `${category ?? ""} ${itemName ?? ""}`.toLowerCase()
  if (/iced|cold brew|cold/.test(text)) return <IcedGlass size={size} />
  if (/pour|filter|v60|chemex|aeropress|kalita|drip/.test(text)) return <PourOver size={size} />
  if (atHome || /moka|stovetop/.test(text)) return <MokaPot size={size} />
  if (/latte|flat white|cappuccino|cortado|gibraltar|matcha|milk|mocha/.test(text)) return <LatteTop size={size} />
  return <SteamingCup size={size} />
}
