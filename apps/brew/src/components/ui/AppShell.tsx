"use client"

import { usePathname, useRouter } from "next/navigation"

type NavItem = { href: string; icon: string; label: string; isAction?: boolean }

const NAV: NavItem[] = [
  { href: "/",            icon: "⌂",  label: "home" },
  { href: "/explore",     icon: "◎",  label: "explore" },
  { href: "/log",         icon: "+",  label: "log", isAction: true },
  { href: "/friends",     icon: "♡",  label: "friends" },
  { href: "/profile",     icon: "◯",  label: "profile" },
]

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()

  return (
    <div style={{
      background: "var(--c-bg)",
      minHeight: "100svh",
      maxWidth: 430,
      margin: "0 auto",
      fontFamily: "var(--font-ui)",
      position: "relative",
    }}>
      <main style={{ paddingBottom: 88 }}>
        {children}
      </main>

      <nav style={{
        position: "fixed",
        bottom: 0,
        left: "50%",
        transform: "translateX(-50%)",
        width: "100%",
        maxWidth: 430,
        background: "var(--c-bg)",
        borderTop: "1px solid var(--c-rule)",
        display: "flex",
        zIndex: 100,
        padding: "12px 0 28px",
      }}>
        {NAV.map(({ href, icon, label, isAction }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href)
          return (
            <button
              key={href}
              onClick={() => router.push(href)}
              style={{
                flex: 1,
                background: "none",
                border: "none",
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 3,
              }}
            >
              {isAction ? (
                <span style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 38,
                  height: 38,
                  borderRadius: 2,
                  background: "var(--c-accent)",
                  color: "#fff",
                  fontSize: 22,
                  fontFamily: "var(--font-ui)",
                }}>
                  {icon}
                </span>
              ) : (
                <>
                  <span style={{ fontSize: 15, color: active ? "var(--c-accent)" : "var(--c-subtle)" }}>
                    {icon}
                  </span>
                  <span style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 9,
                    color: active ? "var(--c-accent)" : "var(--c-subtle)",
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                  }}>
                    {label}
                  </span>
                </>
              )}
            </button>
          )
        })}
      </nav>
    </div>
  )
}
