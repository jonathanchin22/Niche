import { SteamingCup } from "@/components/ui/Doodles"

export default function Loading() {
  return (
    <div role="status" aria-label="Loading" style={{
      minHeight: "100svh", maxWidth: 430, margin: "0 auto",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 18,
    }}>
      <SteamingCup size={150} animated />
      <p className="t-hand" style={{ fontSize: 26 }}>brewing…</p>
    </div>
  )
}
