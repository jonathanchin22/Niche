import type { Metadata, Viewport } from "next"
import { Cormorant_Garamond, DM_Sans, Nanum_Pen_Script, Space_Mono } from "next/font/google"
import "./globals.css"
import { getServerSession } from "@niche/auth/server"
import Observability from "@/components/system/Observability"

// Self-hosted at build time: no render-blocking request to Google on load.
const hand = Nanum_Pen_Script({ weight: "400", subsets: ["latin"], variable: "--nf-hand", display: "swap", adjustFontFallback: false })
const display = Cormorant_Garamond({ weight: ["300", "400", "600"], style: ["normal", "italic"], subsets: ["latin"], variable: "--nf-display", display: "swap" })
const mono = Space_Mono({ weight: ["400", "700"], subsets: ["latin"], variable: "--nf-mono", display: "swap" })
const ui = DM_Sans({ weight: ["400", "500"], subsets: ["latin"], variable: "--nf-ui", display: "swap" })
const fontVars = [hand, display, mono, ui].map(f => f.variable).join(" ")

export const metadata: Metadata = {
  title: "Niche Brew",
  description: "Your brew world — every cup, remembered.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Niche Brew",
  },
  icons: { icon: "/favicon.svg", apple: "/favicon.svg" },
}

export const viewport: Viewport = {
  themeColor: "#f7f3ee",
  width: "device-width",
  initialScale: 1,
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Cached per request (verified locally from the JWT), shared with the page.
  const { user } = await getServerSession()
  return (
    <html lang="en" className={fontVars}>
      <body>
        {children}
        <Observability userId={user?.id ?? null} />
      </body>
    </html>
  )
}
