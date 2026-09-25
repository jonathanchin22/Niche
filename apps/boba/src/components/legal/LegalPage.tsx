import type { ReactNode } from "react"
import Link from "next/link"

/** Plain-language legal pages. Public (no sign-in) so app stores can review them. */
export function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  const support = process.env.NEXT_PUBLIC_SUPPORT_EMAIL
  return (
    <main style={{ maxWidth: 430, margin: "0 auto", padding: "56px 24px 80px", display: "flex", flexDirection: "column", gap: 18 }}>
      <Link href="/" className="t-label">← back</Link>
      <h1 className="t-display" style={{ fontSize: 44 }}>{title}</h1>
      <p className="t-label">last updated {updated}</p>
      <div className="legal" style={{ display: "flex", flexDirection: "column", gap: 14, fontSize: 15, lineHeight: 1.6 }}>
        {children}
      </div>
      {support && <p className="t-meta">Questions? Email <a href={`mailto:${support}`} style={{ textDecoration: "underline" }}>{support}</a>.</p>}
    </main>
  )
}

export function Section({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <h2 className="t-section">{heading}</h2>
      {children}
    </section>
  )
}
