"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { AppShell } from "@/components/ui/AppShell"
import { createClient } from "@niche/auth/client"
import { searchPlaces, searchUsers } from "@niche/database"

type SearchTab = "places" | "people"

interface RecentEntry {
  label: string
  type: SearchTab
  href: string
}

const RECENTS_KEY = "boba-search-recents"

export default function SearchPage() {
  const supabase = useMemo(() => createClient(), [])
  const [query, setQuery] = useState("")
  const [tab, setTab] = useState<SearchTab>("places")
  const [places, setPlaces] = useState<any[]>([])
  const [people, setPeople] = useState<any[]>([])
  const [userId, setUserId] = useState<string>("")
  const [isSearching, setIsSearching] = useState(false)
  const [recents, setRecents] = useState<RecentEntry[]>([])

  useEffect(() => {
    const raw = window.localStorage.getItem(RECENTS_KEY)
    if (!raw) return
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) setRecents(parsed.slice(0, 8))
    } catch {
      // Ignore malformed local storage state.
    }
  }, [])

  useEffect(() => {
    let active = true

    const loadUser = async () => {
      if (!supabase?.auth?.getUser) return
      const { data: { user } } = await supabase.auth.getUser()
      if (active) setUserId(user?.id ?? "")
    }

    void loadUser()
    return () => {
      active = false
    }
  }, [supabase])

  useEffect(() => {
    if (query.trim().length < 2) {
      setPlaces([])
      setPeople([])
      return
    }

    if (!userId) return

    let active = true
    const timer = setTimeout(async () => {
      setIsSearching(true)
      try {
        const [placeResults, userResults] = await Promise.all([
          searchPlaces(supabase as any, { app_id: "boba", query: query.trim() }),
          searchUsers(supabase as any, { query: query.trim(), current_user_id: userId }),
        ])

        if (!active) return
        setPlaces(placeResults as any[])
        setPeople(userResults as any[])
      } finally {
        if (active) setIsSearching(false)
      }
    }, 240)

    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [query, supabase, userId])

  const addRecent = (entry: RecentEntry) => {
    setRecents((prev) => {
      const next = [entry, ...prev.filter((x) => !(x.href === entry.href && x.type === entry.type))].slice(0, 8)
      window.localStorage.setItem(RECENTS_KEY, JSON.stringify(next))
      return next
    })
  }

  const clearRecents = () => {
    setRecents([])
    window.localStorage.removeItem(RECENTS_KEY)
  }

  const showEmpty = query.trim().length >= 2 && !isSearching && places.length === 0 && people.length === 0

  return (
    <AppShell>
      <div style={{ padding: "52px 20px 24px" }}>
        <p style={{ fontFamily: "'Caveat', cursive", fontSize: 15, color: "#888", margin: "0 0 4px" }}>
          find your next sip
        </p>
        <h1 style={{
          fontFamily: "'DM Serif Display', Georgia, serif",
          fontSize: 30,
          color: "#1a1a1a",
          margin: "0 0 20px",
          fontWeight: 400,
        }}>
          search
        </h1>

        <div style={{
          border: "1px solid #e8e8e4",
          borderRadius: 12,
          padding: "11px 14px",
          background: "#fff",
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 14,
        }}>
          <span style={{ color: "#9ea09d", fontSize: 14 }}>⌕</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="search places or people"
            style={{
              flex: 1,
              border: "none",
              outline: "none",
              background: "transparent",
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 15,
              color: "#222",
            }}
          />
          {isSearching && (
            <span style={{ fontFamily: "'Caveat', cursive", fontSize: 14, color: "#9ea09d" }}>...</span>
          )}
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          {(["places", "people"] as const).map((value) => (
            <button
              key={value}
              onClick={() => setTab(value)}
              style={{
                border: `1px solid ${tab === value ? "#2d6a4f" : "#e1e5e0"}`,
                background: tab === value ? "#eef7f1" : "#fff",
                color: tab === value ? "#2d6a4f" : "#8b8f8a",
                borderRadius: 999,
                padding: "6px 12px",
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 12,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                cursor: "pointer",
              }}
            >
              {value}
            </button>
          ))}
        </div>

        {query.trim().length < 2 ? (
          <div style={{
            border: "1px dashed #d9ddd8",
            borderRadius: 12,
            padding: "20px 16px",
            background: "#fff",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <p style={{ margin: 0, fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: "#8e928d", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                recent
              </p>
              {recents.length > 0 && (
                <button
                  onClick={clearRecents}
                  style={{
                    border: "none",
                    background: "none",
                    cursor: "pointer",
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: 11,
                    color: "#8e928d",
                  }}
                >
                  clear
                </button>
              )}
            </div>

            {recents.length === 0 ? (
              <p style={{ margin: 0, color: "#9aa09a", fontFamily: "'Caveat', cursive", fontSize: 18 }}>
                start typing to search places and friends
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {recents.map((entry) => (
                  <Link
                    key={`${entry.type}:${entry.href}`}
                    href={entry.href}
                    style={{
                      textDecoration: "none",
                      border: "1px solid #ebefea",
                      borderRadius: 10,
                      padding: "10px 12px",
                      background: "#fafdfb",
                      color: "#1f2520",
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: 13,
                      display: "block",
                    }}
                  >
                    <span style={{ color: "#8e928d", textTransform: "uppercase", fontSize: 10, letterSpacing: "0.06em", marginRight: 6 }}>
                      {entry.type}
                    </span>
                    {entry.label}
                  </Link>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {(tab === "places" ? places : people).map((item: any) => {
              const isPlace = tab === "places"
              const href = isPlace ? `/place/${item.id}` : `/friends?user=${item.id}`
              const label = isPlace ? item.name : (item.display_name || item.username || "unknown")
              const sub = isPlace
                ? [item.city, item.state].filter(Boolean).join(", ")
                : item.username ? `@${item.username}` : "person"

              return (
                <Link
                  key={item.id}
                  href={href}
                  onClick={() => addRecent({ label, type: tab, href })}
                  style={{
                    textDecoration: "none",
                    border: "1px solid #e8e8e4",
                    background: "#fff",
                    borderRadius: 12,
                    padding: "12px 14px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 10,
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <p style={{
                      margin: "0 0 3px",
                      fontFamily: "'DM Serif Display', Georgia, serif",
                      color: "#1f2520",
                      fontSize: 17,
                    }}>
                      {label}
                    </p>
                    <p style={{
                      margin: 0,
                      fontFamily: "'DM Sans', sans-serif",
                      color: "#868a84",
                      fontSize: 12,
                    }}>
                      {sub || (isPlace ? "place" : "user")}
                    </p>
                  </div>
                  <span style={{ color: "#9ea39d" }}>→</span>
                </Link>
              )
            })}

            {showEmpty && (
              <div style={{
                border: "1px dashed #d9ddd8",
                borderRadius: 12,
                padding: "24px 14px",
                textAlign: "center",
                background: "#fff",
              }}>
                <p style={{
                  margin: "0 0 6px",
                  fontFamily: "'Caveat', cursive",
                  color: "#939790",
                  fontSize: 18,
                }}>
                  no results yet
                </p>
                <p style={{
                  margin: 0,
                  fontFamily: "'DM Sans', sans-serif",
                  color: "#a1a59f",
                  fontSize: 12,
                }}>
                  try a different name, username, or tea shop
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </AppShell>
  )
}
