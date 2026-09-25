"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import type { ReactNode } from "react"

const ICONS: Record<string, ReactNode> = {
  home: <path d="M3 9 L10 3 L17 9 V17 H12 V12 H8 V17 H3 Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />,
  explore: <><circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.5" /><path d="M13.5 13.5 L17 17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></>,
  friends: <><circle cx="7" cy="7" r="3" stroke="currentColor" strokeWidth="1.5" /><circle cx="14" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.5" /><path d="M2 17 Q2 12 7 12 Q12 12 12 17M12.5 12.5 Q18 12 18 17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></>,
  you: <><circle cx="10" cy="7" r="3.5" stroke="currentColor" strokeWidth="1.5" /><path d="M3.5 17.5 Q3.5 12 10 12 Q16.5 12 16.5 17.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></>,
}

const NAV = [
  { href: "/", key: "home", label: "Home" },
  { href: "/explore", key: "explore", label: "Explore" },
  { href: "/log", key: "log", label: "Log a drink" },
  { href: "/friends", key: "friends", label: "Friends" },
  { href: "/profile", key: "you", label: "You" },
]

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/"
  if (href === "/explore") return pathname.startsWith("/explore") || pathname.startsWith("/place")
  return pathname.startsWith(href)
}

export default function AppShell({ children, nav = true }: { children: ReactNode; nav?: boolean }) {
  const pathname = usePathname()

  return (
    <div style={{ background: "var(--c-bg)", minHeight: "100svh", maxWidth: 430, margin: "0 auto", position: "relative" }}>
      <main style={{ paddingBottom: nav ? 110 : 0 }}>{children}</main>

      {nav && (
        <nav aria-label="Main" style={{
          position: "fixed", left: "50%", bottom: "max(22px, env(safe-area-inset-bottom))", transform: "translateX(-50%)",
          height: 56, padding: "0 6px", display: "flex", alignItems: "center", gap: 2, zIndex: 100,
          background: "var(--c-paper)", border: "1px solid var(--c-rule)", borderRadius: 28,
        }}>
          {NAV.map(({ href, key, label }) => {
            if (key === "log") {
              return (
                <Link key={key} href={href} aria-label={label} style={{
                  width: 44, height: 44, borderRadius: 22, background: "var(--c-ink)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <path d="M8 2v12M2 8h12" stroke="var(--c-bg)" strokeWidth="1.6" strokeLinecap="round" />
                  </svg>
                </Link>
              )
            }
            const active = isActive(pathname, href)
            return (
              <Link key={key} href={href} aria-label={label} aria-current={active ? "page" : undefined} style={{
                width: 48, height: 44, display: "flex", alignItems: "center", justifyContent: "center",
                color: active ? "var(--c-ink)" : "var(--c-subtle)",
              }}>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">{ICONS[key]}</svg>
              </Link>
            )
          })}
        </nav>
      )}
    </div>
  )
}
