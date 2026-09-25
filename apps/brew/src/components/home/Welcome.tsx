import Link from "next/link"
import { Underline } from "@/components/ui/Doodles"
import { PlusIcon } from "@/components/ui/Primitives"
import { Masthead } from "./Cover"

/** First run: shown until someone has logged a cup or followed a friend. */
export function Welcome({ issue, date, peopleHere }: { issue: number; date: string; peopleHere: number }) {
  return (
    <div>
      <Masthead issue={issue} date={date} />
      <img src="/img/welcome.jpg" alt="Friends clinking latte cups" className="photo" style={{ width: "calc(100% - 24px)", height: 300, margin: "0 12px" }} />

      <section style={{ display: "flex", flexDirection: "column", gap: 8, padding: "18px 24px 0" }}>
        <span className="t-label" style={{ letterSpacing: "0.16em" }}>your first issue</span>
        <h1 className="t-display" style={{ fontSize: 40, lineHeight: 0.98 }}>starts with<br />one good cup.</h1>
        <span style={{ marginTop: -8 }}><Underline /></span>
      </section>

      <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "22px 24px 0" }}>
        <Link href="/log" className="btn btn-primary"><PlusIcon size={14} />log your first cup</Link>
        <Link href="/friends" className="btn btn-secondary">
          find friends{peopleHere > 0 ? ` · ${peopleHere} already here` : ""}
        </Link>
      </div>
    </div>
  )
}
