import Link from "next/link"
import { Underline } from "@/components/ui/Doodles"
import { PlusIcon } from "@/components/ui/Primitives"
import { Masthead } from "./Cover"

/** First run: shown until someone has logged a drink or followed a friend. */
export function Welcome({ sip, date, peopleHere }: { sip: number; date: string; peopleHere: number }) {
  return (
    <div>
      <Masthead sip={sip} date={date} />
      <img src="/img/welcome.jpg" alt="Two bottles of milk tea with pearls on a wooden table" className="photo" style={{ width: "calc(100% - 24px)", height: 320, margin: "0 12px", borderRadius: 24 }} />

      <section style={{ display: "flex", flexDirection: "column", gap: 8, padding: "20px 24px 0" }}>
        <span className="t-label">your first sip</span>
        <h1 className="t-display" style={{ fontSize: 42, lineHeight: 1 }}>every great order<br />starts somewhere.</h1>
        <span style={{ marginTop: -4 }}><Underline width={180} /></span>
      </section>

      <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "22px 24px 0" }}>
        <Link href="/log" className="btn btn-primary"><PlusIcon size={14} />log your first boba</Link>
        <Link href="/friends" className="btn btn-secondary">
          find friends{peopleHere > 0 ? ` · ${peopleHere} already here` : ""}
        </Link>
      </div>
    </div>
  )
}
