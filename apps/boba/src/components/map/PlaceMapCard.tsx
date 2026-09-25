"use client"

import dynamic from "next/dynamic"

const CafeMap = dynamic(() => import("./CafeMap"), {
  ssr: false,
  loading: () => <div style={{ height: 180, background: "var(--c-tint)", borderRadius: 18 }} />,
})

/** A small map of one place, for its page. Client-only; MapLibre loads lazily. */
export default function PlaceMapCard({ id, name, lat, lng, score }: { id: string; name: string; lat: number; lng: number; score: number | null }) {
  return (
    <CafeMap center={{ lat, lng }} pins={[{ id, name, lat, lng, score, href: `/place/${id}` }]} height={180} showMe={false} zoom={15.5} />
  )
}
