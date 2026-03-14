"use client"

import FeedClient from "@/components/feed/FeedClient"

export default function FriendsClient({ userId }: { userId: string }) {
  return <FeedClient userId={userId} />
}
