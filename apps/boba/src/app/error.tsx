"use client"

import { useEffect } from "react"
import Link from "next/link"
import { SleepyPearl } from "@/components/ui/Doodles"

/** Anything a page throws lands here instead of Next's bare error screen. */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error) }, [error])

  return (
    <main style={{
      minHeight: "100svh", maxWidth: 430, margin: "0 auto", padding: "0 32px",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, textAlign: "center",
    }}>
      <SleepyPearl size={130} />
      <h1 className="t-display" style={{ fontSize: 38 }}>that one spilled.</h1>
      <p className="t-meta">Something went wrong loading this page. It’s usually a blip.</p>
      <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
        <button type="button" onClick={reset} className="btn btn-primary" style={{ padding: "0 22px" }}>try again</button>
        <Link href="/" className="btn btn-secondary" style={{ padding: "0 22px" }}>home</Link>
      </div>
    </main>
  )
}
