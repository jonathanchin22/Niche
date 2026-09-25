import type { Metadata, Viewport } from "next"
import { Providers } from "./providers"
import "./globals.css"

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
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
