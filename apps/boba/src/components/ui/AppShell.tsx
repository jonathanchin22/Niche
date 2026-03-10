"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

type Tab = "friends" | "explore" | "log" | "profile"

interface AppShellProps {
  children: React.ReactNode
  activeTab: Tab
}

const NAV_ITEMS: { id: Tab; icon: string; label: string; href: string }[] = [
  { id: "friends", icon: "👥", label: "Friends", href: "/" },
  { id: "explore", icon: "🗺", label: "Explore", href: "/explore" },
  { id: "log", icon: "＋", label: "Log", href: "/log" },
  { id: "profile", icon: "👤", label: "Profile", href: "/profile" },
]

export function AppShell({ children, activeTab }: AppShellProps) {
  return (
    <div className="flex flex-col min-h-screen bg-boba-bg max-w-md mx-auto">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-boba-bg/90 backdrop-blur-sm px-5 pt-12 pb-3 border-b border-boba-divider">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-boba-text leading-none">boba!</h1>
            <p className="text-[10px] text-boba-tertiary mt-0.5">bubble tea, ranked by fans</p>
          </div>
          <Link href="/notifications" className="w-9 h-9 rounded-full bg-boba-soft flex items-center justify-center text-base">
            🔔
          </Link>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto pb-24">
        {children}
      </main>

      {/* Bottom navigation */}
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white/90 backdrop-blur-md border-t border-boba-divider pb-safe">
        <div className="flex">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              className="flex-1 flex flex-col items-center gap-1 py-2.5"
            >
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-base transition-all ${
                activeTab === item.id
                  ? "bg-boba-accent shadow-lg shadow-boba-accent/30"
                  : ""
              }`}>
                <span className={activeTab === item.id ? "" : "opacity-40"}>
                  {item.icon}
                </span>
              </div>
              <span className={`text-[9px] font-bold tracking-wide ${
                activeTab === item.id ? "text-boba-accent" : "text-boba-tertiary"
              }`}>
                {item.label}
              </span>
            </Link>
          ))}
        </div>
      </nav>
    </div>
  )
}
