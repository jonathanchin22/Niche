"use client"

import React from "react"

// ─── MonoLabel ────────────────────────────────────────────────────────────────
export function MonoLabel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <p style={{
      fontFamily: "var(--font-mono)",
      fontSize: 9,
      color: "var(--c-subtle)",
      letterSpacing: "0.12em",
      textTransform: "uppercase",
      margin: 0,
      ...style,
    }}>
      {children}
    </p>
  )
}

// ─── Stars ────────────────────────────────────────────────────────────────────
export function Stars({ value = 0, onChange, size = 16 }: {
  value?: number
  onChange?: (n: number) => void
  size?: number
}) {
  return (
    <div style={{ display: "flex", gap: 3 }}>
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          onClick={() => onChange?.(n)}
          style={{
            background: "none",
            border: "none",
            fontSize: size,
            padding: 0,
            cursor: onChange ? "pointer" : "default",
            color: n <= value ? "var(--c-gold)" : "var(--c-rule)",
            lineHeight: 1,
          }}
        >
          ★
        </button>
      ))}
    </div>
  )
}

// ─── Pill ─────────────────────────────────────────────────────────────────────
export function Pill({ active, onClick, children }: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: 10,
        padding: "4px 12px",
        borderRadius: 2,
        border: `1px solid ${active ? "var(--c-accent)" : "var(--c-rule)"}`,
        background: active ? "var(--c-accent-bg)" : "transparent",
        color: active ? "var(--c-accent)" : "var(--c-subtle)",
        cursor: "pointer",
        whiteSpace: "nowrap" as const,
        letterSpacing: "0.06em",
        textTransform: "uppercase" as const,
      }}
    >
      {children}
    </button>
  )
}

// ─── Rule ─────────────────────────────────────────────────────────────────────
export function Rule({ my = 24 }: { my?: number }) {
  return <div style={{ height: 1, background: "var(--c-rule)", margin: `${my}px 0` }} />
}

// ─── SectionDivider ───────────────────────────────────────────────────────────
export function SectionDivider({ label }: { label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "28px 28px 0" }}>
      <div style={{ flex: 1, height: 1, background: "var(--c-rule)" }} />
      <MonoLabel>{label}</MonoLabel>
      <div style={{ flex: 1, height: 1, background: "var(--c-rule)" }} />
    </div>
  )
}

// ─── Sketches ─────────────────────────────────────────────────────────────────
export function CupSteamSketch({ size = 90, stroke = "var(--c-ink)" }: { size?: number; stroke?: string }) {
  return (
    <svg width={size} height={size * 1.4} viewBox="0 0 90 126" fill="none">
      <ellipse cx="45" cy="108" rx="30" ry="7" stroke={stroke} strokeWidth="1.2" fill="none" opacity="0.4" />
      <path d="M22 60 Q20 106 14 108 Q45 118 76 108 Q70 106 68 60 Z" stroke={stroke} strokeWidth="1.5" fill="none" strokeLinejoin="round" />
      <ellipse cx="45" cy="60" rx="23" ry="6" stroke={stroke} strokeWidth="1.5" fill="none" />
      <path d="M68 70 Q84 70 84 84 Q84 98 68 94" stroke={stroke} strokeWidth="1.5" fill="none" strokeLinecap="round" />
      <path d="M32 46 Q36 34 32 22" stroke={stroke} strokeWidth="1.2" fill="none" strokeLinecap="round" opacity="0.5" />
      <path d="M45 40 Q49 28 45 16" stroke={stroke} strokeWidth="1.2" fill="none" strokeLinecap="round" opacity="0.5" />
      <path d="M58 44 Q62 32 58 20" stroke={stroke} strokeWidth="1.2" fill="none" strokeLinecap="round" opacity="0.5" />
    </svg>
  )
}

export function AeroSketch({ stroke = "var(--c-ink)" }: { stroke?: string }) {
  return (
    <svg width="160" height="110" viewBox="0 0 160 110" fill="none">
      <rect x="52" y="30" width="56" height="62" rx="4" stroke={stroke} strokeWidth="1.5" fill="none" />
      <rect x="58" y="36" width="44" height="50" rx="2" stroke={stroke} strokeWidth="1" fill="none" opacity="0.4" />
      <line x1="80" y1="5" x2="80" y2="36" stroke={stroke} strokeWidth="2" strokeLinecap="round" />
      <line x1="65" y1="5" x2="95" y2="5" stroke={stroke} strokeWidth="2" strokeLinecap="round" />
      <path d="M38 92 L42 110 Q80 118 118 110 L122 92 Z" stroke={stroke} strokeWidth="1.2" fill="none" strokeLinejoin="round" />
      <path d="M36 92 Q80 84 124 92" stroke={stroke} strokeWidth="1.2" strokeLinecap="round" fill="none" />
      <path d="M62 86 Q66 78 62 70" stroke={stroke} strokeWidth="1" strokeLinecap="round" opacity="0.4" />
      <path d="M80 82 Q84 74 80 66" stroke={stroke} strokeWidth="1" strokeLinecap="round" opacity="0.4" />
      <text x="64" y="62" fontFamily="monospace" fontSize="7" fill={stroke} opacity="0.3">COFFEE</text>
    </svg>
  )
}
