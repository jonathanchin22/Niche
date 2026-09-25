import Link from "next/link"
import { SleepyBean } from "@/components/ui/Doodles"

export default function NotFound() {
  return (
    <main style={{
      minHeight: "100svh", maxWidth: 430, margin: "0 auto", padding: "0 32px",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, textAlign: "center",
    }}>
      <SleepyBean size={130} />
      <h1 className="t-display" style={{ fontSize: 40 }}>nothing brewing here.</h1>
      <p className="t-meta">This cup, café or person doesn’t exist, or it was deleted.</p>
      <Link href="/" className="btn btn-primary" style={{ padding: "0 22px", marginTop: 8 }}>back home</Link>
    </main>
  )
}
