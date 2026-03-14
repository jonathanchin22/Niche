"use client"

import { useRouter } from "next/navigation"
import ReviewModal from "@/components/review/ReviewModal"

export default function LogClient({ userId }: { userId: string }) {
  const router = useRouter()
  return (
    <ReviewModal
      userId={userId}
      onSuccess={() => router.push("/")}
      onClose={() => router.back()}
    />
  )
}
