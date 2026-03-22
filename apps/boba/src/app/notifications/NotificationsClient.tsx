"use client"

import { useEffect, useMemo, useState } from "react"
import { createClient } from "@niche/auth/client"
import { getNotifications, markNotificationsRead } from "@niche/database"
import { AppShell } from "@/components/ui/AppShell"
import type { Notification } from "@niche/shared-types"

interface NotificationsClientProps {
  userId: string
  initialNotifications: Notification[]
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  const hours = Math.floor(mins / 60)
  const days = Math.floor(hours / 24)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m`
  if (hours < 24) return `${hours}h`
  if (days < 7) return `${days}d`
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

function toNotificationCopy(n: Notification) {
  const actor = n.actor?.display_name || n.actor?.username || "someone"

  if (n.type === "new_follower") {
    return `${actor} started following you`
  }

  if (n.type === "review_like") {
    if (n.review?.item_name) return `${actor} liked your review of ${n.review.item_name}`
    return `${actor} liked your review`
  }

  if (n.type === "review_comment") {
    return `${actor} commented on your review`
  }

  if (n.type === "badge_earned") {
    return `you earned a new badge`
  }

  return "new activity"
}

export function NotificationsClient({ userId, initialNotifications }: NotificationsClientProps) {
  const supabase = useMemo(() => createClient(), [])
  const [notifications, setNotifications] = useState<Notification[]>(initialNotifications)

  useEffect(() => {
    let mounted = true
    let channel: any = null

    const refresh = async () => {
      try {
        const latest = await getNotifications(supabase as any, { user_id: userId, limit: 50 })
        if (mounted) setNotifications(latest)
      } catch {
        // Silent fail keeps page usable during temporary backend issues.
      }
    }

    const unreadIds = initialNotifications.filter((n) => !n.read).map((n) => n.id)
    if (unreadIds.length > 0) {
      void markNotificationsRead(supabase as any, { user_id: userId, ids: unreadIds })
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    }

    if (typeof (supabase as any).channel === "function") {
      channel = (supabase as any)
        .channel(`boba-notification-feed-${userId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${userId}`,
          },
          () => {
            void refresh()
          }
        )
        .subscribe()
    }

    return () => {
      mounted = false
      if (channel && typeof (supabase as any).removeChannel === "function") {
        void (supabase as any).removeChannel(channel)
      }
    }
  }, [initialNotifications, supabase, userId])

  return (
    <AppShell>
      <div style={{ padding: "52px 22px 24px" }}>
        <p style={{ fontFamily: "'Caveat', cursive", fontSize: 15, color: "#888", margin: "0 0 4px" }}>
          your activity
        </p>
        <h1 style={{
          fontFamily: "'DM Serif Display', Georgia, serif",
          fontSize: 30,
          color: "#1a1a1a",
          margin: "0 0 22px",
          fontWeight: 400,
        }}>
          notifications
        </h1>

        {notifications.length === 0 ? (
          <div style={{
            border: "1px dashed #d9ddd8",
            borderRadius: 12,
            padding: "36px 20px",
            textAlign: "center",
            background: "#fff",
          }}>
            <p style={{
              fontFamily: "'Caveat', cursive",
              fontSize: 18,
              margin: "0 0 6px",
              color: "#8a8a86",
            }}>
              no notifications yet
            </p>
            <p style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 12,
              margin: 0,
              color: "#9a9a95",
            }}>
              likes, follows, and comments from friends will appear here.
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {notifications.map((n) => (
              <div
                key={n.id}
                style={{
                  display: "flex",
                  gap: 12,
                  alignItems: "center",
                  border: `1px solid ${n.read ? "#e8e8e4" : "#d8e8df"}`,
                  borderRadius: 12,
                  padding: "12px 14px",
                  background: n.read ? "#fff" : "#f7fbf8",
                }}
              >
                <div style={{
                  width: 34,
                  height: 34,
                  borderRadius: "50%",
                  border: "1px solid #dfe5df",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#2d6a4f",
                  fontFamily: "'DM Serif Display', Georgia, serif",
                  fontSize: 14,
                  background: "#eef7f1",
                  flexShrink: 0,
                }}>
                  {(n.actor?.display_name || n.actor?.username || "!").slice(0, 1).toUpperCase()}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{
                    margin: 0,
                    color: "#222",
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: 13,
                    lineHeight: 1.35,
                  }}>
                    {toNotificationCopy(n)}
                  </p>
                  <p style={{
                    margin: "4px 0 0",
                    color: "#8a8a86",
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: 11,
                  }}>
                    {timeAgo(n.created_at)}
                  </p>
                </div>

                {!n.read && (
                  <span style={{
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    background: "#2d6a4f",
                    flexShrink: 0,
                  }} />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  )
}
