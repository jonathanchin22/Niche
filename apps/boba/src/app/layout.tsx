import type { Metadata, Viewport } from "next"
import { DM_Sans, DM_Serif_Display, Nanum_Pen_Script } from "next/font/google"
import "./globals.css"

// Self-hosted at build time: no render-blocking request to Google on load.
const hand = Nanum_Pen_Script({ weight: "400", subsets: ["latin"], variable: "--nf-hand", display: "swap", adjustFontFallback: false })
const display = DM_Serif_Display({ weight: "400", style: ["normal", "italic"], subsets: ["latin"], variable: "--nf-display", display: "swap" })
const ui = DM_Sans({ weight: ["400", "500", "600"], subsets: ["latin"], variable: "--nf-ui", display: "swap" })
const fontVars = [hand, display, ui].map(f => f.variable).join(" ")

export const metadata: Metadata = {
  title: "boba! — bubble tea, ranked by fans",
  description: "Log, rate, and discover the best bubble tea with your friends.",
  manifest: "/manifest.json",
  icons: { icon: "/favicon.svg" },
  appleWebApp: { capable: true, statusBarStyle: "default", title: "boba!" },
  other: { "mobile-web-app-capable": "yes" },
  openGraph: { title: "boba!", description: "Bubble tea, ranked by fans", type: "website" },
}

export const viewport: Viewport = {
  themeColor: "#f6f3ec",
  width: "device-width",
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={fontVars}>
      <body>
        {children}
      </body>
    </html>
  )
}
