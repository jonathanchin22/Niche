"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

type Tab = "home" | "explore" | "log" | "friends" | "friends-list" | "profile"

interface AppShellProps {
  children: React.ReactNode
  activeTab?: Tab
}

export function AppShell({ children, activeTab }: AppShellProps) {
  const pathname = usePathname()

  const isActive = (tabId: string) => {
    if (tabId === "home" && pathname === "/") return true
    if (tabId === "explore" && pathname.startsWith("/explore")) return true
    if (tabId === "friends" && pathname.startsWith("/friends")) return true
    if (tabId === "profile" && pathname.startsWith("/profile")) return true
    return activeTab === tabId
  }

  return (
    <>
      <style>{`
        .niche-app * { box-sizing: border-box; }
        .niche-app input::placeholder, .niche-app textarea::placeholder { color: #bbb; }
        .niche-app button:focus { outline: none; }
        .niche-app ::-webkit-scrollbar { display: none; }
        .tab-btn { transition: color 0.15s ease; }
        .card-hover { transition: transform 0.15s ease, box-shadow 0.15s ease; }
        .card-hover:active { transform: scale(0.98); }
        .log-btn { transition: transform 0.15s ease; }
        .log-btn:active { transform: scale(0.92); }
      `}</style>
      <div className="niche-app" style={{
        background: "#fafaf8",
        minHeight: "100vh",
        maxWidth: 430,
        margin: "0 auto",
        position: "relative",
        fontFamily: "'DM Sans', system-ui, sans-serif",
        paddingBottom: 80,
      }}>
        {children}

        {/* Bottom Nav */}
        <nav style={{
          position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)",
          width: "100%", maxWidth: 430,
          background: "#fafaf8",
          borderTop: "1px solid #e8e8e4",
          display: "flex",
          zIndex: 100,
          padding: "10px 0 24px",
        }}>
          {[
            { id: "home", href: "/", icon: "⌂", label: "home" },
            { id: "explore", href: "/explore", icon: "◎", label: "explore" },
            { id: "log", href: "/log", icon: "+", label: "" },
            { id: "friends", href: "/friends", icon: "♡", label: "friends" },
            { id: "profile", href: "/profile", icon: "◯", label: "me" },
          ].map((tab) => (
            <Link key={tab.id} href={tab.href} style={{
              flex: 1,
              display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
              padding: "4px 0",
              textDecoration: "none",
            }}>
              {tab.id === "log" ? (
                <span className="log-btn" style={{
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  width: 38, height: 38, borderRadius: "50%",
                  background: "#2d6a4f", color: "#fff",
                  fontSize: 22, fontFamily: "'DM Sans', sans-serif",
                  lineHeight: 1,
                }}>+</span>
              ) : (
                <>
                  <span className="tab-btn" style={{
                    fontSize: 18,
                    color: isActive(tab.id) ? "#2d6a4f" : "#aaa",
                    fontWeight: isActive(tab.id) ? 700 : 400,
                    lineHeight: 1,
                  }}>{tab.icon}</span>
                  <span style={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: 10,
                    color: isActive(tab.id) ? "#2d6a4f" : "#aaa",
                    letterSpacing: "0.05em",
                    textTransform: "uppercase",
                  }}>{tab.label}</span>
                </>
              )}
            </Link>
          ))}
        </nav>
      </div>
    </>
  )
}
