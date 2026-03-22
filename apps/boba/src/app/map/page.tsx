"use client"

import dynamic from "next/dynamic"

const MapView = dynamic(() => import("./MapView"), {
  ssr: false,
  loading: () => (
    <div style={{ minHeight: "100vh", padding: "52px 16px 20px", background: "#fafaf8" }}>
      <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "#7f857f" }}>loading map...</p>
    </div>
  ),
})

export default function MapPage() {
  return <MapView />
}
