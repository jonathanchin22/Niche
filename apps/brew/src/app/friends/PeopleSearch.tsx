"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { createClient } from "@niche/auth/client"
import { getFollowing, searchUsers } from "@niche/database"
import { Avatar, SearchField } from "@/components/ui/Primitives"
import FollowButton from "@/components/profile/FollowButton"

export default function PeopleSearch({ viewerId }: { viewerId: string }) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<any[] | null>(null)
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) { setResults(null); return }
    const t = setTimeout(async () => {
      const supabase = createClient()
      const [found, following] = await Promise.all([
        searchUsers(supabase, { query: q, current_user_id: viewerId }).catch(() => []),
        getFollowing(supabase, viewerId).catch(() => []),
      ])
      setFollowingIds(new Set(following.map((f: any) => f.id)))
      setResults(found)
    }, 250)
    return () => clearTimeout(t)
  }, [query, viewerId])

  return (
    <div style={{ padding: "16px 24px 0" }}>
      <SearchField id="find" label="Find people" value={query} onChange={setQuery} placeholder="find people by name or @handle" />
      {results && (
        <div style={{ paddingTop: 6 }}>
          {results.length === 0 && <p className="t-meta" style={{ padding: "14px 0" }}>No one by that name yet.</p>}
          {results.map(p => (
            <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderBottom: "1px solid var(--c-rule)" }}>
              <Link href={`/profile/${p.username}`} style={{ display: "flex", alignItems: "center", gap: 12, flexGrow: 1, minWidth: 0 }}>
                <Avatar user={p} size={36} />
                <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <span style={{ fontSize: 15, fontWeight: 500 }}>{p.username}</span>
                  {p.display_name && p.display_name !== p.username && <span style={{ fontSize: 12, color: "var(--c-mid)" }}>{p.display_name}</span>}
                </span>
              </Link>
              <FollowButton key={`${p.id}-${followingIds.has(p.id)}`} viewerId={viewerId} targetId={p.id} initialFollowing={followingIds.has(p.id)} size="sm" />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
