import type { Metadata, Viewport } from "next"
import { Nunito, Caveat, DM_Serif_Display, DM_Sans } from "next/font/google"
import { Providers } from "./providers"
import "./globals.css"

const nunito = Nunito({
  subsets: ["latin"],
  variable: "--font-nunito",
  weight: ["400", "600", "700", "800", "900"],
})

const caveat = Caveat({
  subsets: ["latin"],
  variable: "--font-caveat",
  weight: ["400", "600", "700"],
})

const dmSerif = DM_Serif_Display({
  subsets: ["latin"],
  variable: "--font-dm-serif",
  weight: ["400"],
})

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  weight: ["300", "400", "500", "600"],
})

export const metadata: Metadata = {
  title: "boba! — bubble tea, ranked by fans",
  description: "Log, rate, and discover the best bubble tea spots with your friends.",
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon.svg",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "boba!",
  },
  openGraph: {
    title: "boba!",
    description: "Bubble tea, ranked by fans",
    type: "website",
  },
}

export const viewport: Viewport = {
  themeColor: "#7C3AED",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={nunito.variable}>
      <body className="bg-boba-bg font-nunito antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}