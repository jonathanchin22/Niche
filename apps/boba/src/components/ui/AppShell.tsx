"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

type Tab = "friends" | "explore" | "log" | "friends-list" | "profile"

interface AppShellProps {
  children: React.ReactNode
  activeTab?: Tab
}

const tabs = [
  {
    id: "friends",
    href: "/",
    label: "Friends",
    icon: (active: boolean) => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={active ? "#7C3AED" : "#9CA3AF"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
  },
  {
    id: "explore",
    href: "/explore",
    label: "Explore",
    icon: (active: boolean) => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={active ? "#7C3AED" : "#9CA3AF"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8"/>
        <path d="m21 21-4.35-4.35"/>
      </svg>
    ),
  },
  {
    id: "log",
    href: "/log",
    label: "",
    icon: (_active: boolean) => (
      <div className="w-12 h-12 rounded-full flex items-center justify-center shadow-lg" style={{ background: "linear-gradient(135deg, #7C3AED, #9F67FF)" }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
          <path d="M12 5v14M5 12h14"/>
        </svg>
      </div>
    ),
  },
  {
    id: "friends-list",
    href: "/friends",
    label: "Friends",
    icon: (active: boolean) => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={active ? "#7C3AED" : "#9CA3AF"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
        <circle cx="12" cy="7" r="4"/>
      </svg>
    ),
  },
  {
    id: "profile",
    href: "/profile",
    label: "Me",
    icon: (active: boolean) => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill={active ? "#7C3AED" : "none"} stroke={active ? "#7C3AED" : "#9CA3AF"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
        <circle cx="12" cy="7" r="4"/>
      </svg>
    ),
  },
]

export function AppShell({ children, activeTab }: AppShellProps) {
  const pathname = usePathname()

  const isActive = (tabId: string) => {
    if (tabId === "friends" && pathname === "/") return true
    if (tabId === "explore" && pathname.startsWith("/explore")) return true
    if (tabId === "friends-list" && pathname.startsWith("/friends")) return true
    if (tabId === "profile" && pathname.startsWith("/profile")) return true
    return activeTab === tabId
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "linear-gradient(135deg, #FAFAFE 0%, #F0EBFF 100%)" }}>
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-purple-100">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
          <h1 className="text-xl font-black" style={{ color: "#7C3AED" }}>boba!</h1>
          <Link href="/profile" className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 max-w-lg mx-auto w-full pb-24">
        {children}
      </main>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-t border-purple-100" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        <div className="max-w-lg mx-auto px-2 h-16 flex items-center justify-around">
          {tabs.map((tab) => {
            const active = isActive(tab.id)
            if (tab.id === "log") {
              return (
                <Link key={tab.id} href={tab.href} className="flex items-center justify-center -mt-4">
                  {tab.icon(false)}
                </Link>
              )
            }
            return (
              <Link
                key={tab.id}
                href={tab.href}
                className="flex flex-col items-center gap-0.5 py-1 px-3"
              >
                {tab.icon(active)}
                {tab.label && (
                  <span className="text-xs font-medium" style={{ color: active ? "#7C3AED" : "#9CA3AF" }}>
                    {tab.label}
                  </span>
                )}
              </Link>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
