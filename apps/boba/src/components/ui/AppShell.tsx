"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import { createClient } from "@niche/auth/client"
import { getUnreadNotificationCount } from "@niche/database"

type Tab = "home" | "explore" | "map" | "log" | "friends" | "friends-list" | "profile"

interface AppShellProps {
  children: React.ReactNode
  activeTab?: Tab
}

export function AppShell({ children, activeTab }: AppShellProps) {
  const pathname = usePathname()
  const supabase = useMemo(() => createClient(), [])
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    let mounted = true
    let channel: any = null

    const refreshUnreadCount = async (userId: string) => {
      try {
        const count = await getUnreadNotificationCount(supabase as any, { user_id: userId })
        if (mounted) setUnreadCount(count)
      } catch {
        // Keep UI resilient if notifications table is temporarily unavailable.
      }
    }

    const init = async () => {
      if (!supabase?.auth?.getUser) return
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        if (mounted) setUnreadCount(0)
        return
      }

      await refreshUnreadCount(user.id)

      if (typeof (supabase as any).channel !== "function") return

      channel = (supabase as any)
        .channel(`boba-notifications-${user.id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${user.id}`,
          },
          () => {
            void refreshUnreadCount(user.id)
          }
        )
        .subscribe()
    }

    void init()

    return () => {
      mounted = false
      if (channel && typeof (supabase as any).removeChannel === "function") {
        void (supabase as any).removeChannel(channel)
      }
    }
  }, [supabase])

  const isActive = (tabId: string) => {
    if (tabId === "home" && pathname === "/") return true
    if (tabId === "explore" && pathname.startsWith("/explore")) return true
    if (tabId === "map" && pathname.startsWith("/map")) return true
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
        <Link href="/search" aria-label="Search" style={{
          position: "fixed",
          top: 12,
          left: "max(12px, calc((100vw - 430px) / 2 + 12px))",
          width: 34,
          height: 34,
          borderRadius: "50%",
          border: "1px solid #e8e8e4",
          background: pathname.startsWith("/search") ? "#e8f4ee" : "#fff",
          color: pathname.startsWith("/search") ? "#2d6a4f" : "#777",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          textDecoration: "none",
          zIndex: 101,
          boxShadow: "0 2px 10px rgba(0,0,0,0.04)",
        }}>
          <span style={{ fontSize: 13, lineHeight: 1 }}>⌕</span>
        </Link>

        <Link href="/notifications" aria-label="Notifications" style={{
          position: "fixed",
          top: 12,
          right: "max(12px, calc((100vw - 430px) / 2 + 12px))",
          width: 34,
          height: 34,
          borderRadius: "50%",
          border: "1px solid #e8e8e4",
          background: pathname.startsWith("/notifications") ? "#e8f4ee" : "#fff",
          color: pathname.startsWith("/notifications") ? "#2d6a4f" : "#777",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          textDecoration: "none",
          zIndex: 101,
          boxShadow: "0 2px 10px rgba(0,0,0,0.04)",
        }}>
          <span style={{ fontSize: 14, lineHeight: 1 }}>◉</span>
          {unreadCount > 0 && (
            <span style={{
              position: "absolute",
              top: -6,
              right: -4,
              minWidth: 18,
              height: 18,
              borderRadius: 999,
              background: "#2d6a4f",
              color: "#fff",
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 10,
              fontWeight: 700,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "0 5px",
              border: "2px solid #fafaf8",
            }}>
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Link>

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
            { id: "map", href: "/map", icon: "⌖", label: "map" },
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
