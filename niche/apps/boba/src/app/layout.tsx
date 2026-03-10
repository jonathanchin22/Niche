import type { Metadata } from "next"
import { Nunito } from "next/font/google"
import { Providers } from "./providers"
import "./globals.css"

const nunito = Nunito({
  subsets: ["latin"],
  variable: "--font-nunito",
  weight: ["400", "600", "700", "800", "900"],
})

export const metadata: Metadata = {
  title: "boba! — bubble tea, ranked by fans",
  description: "Log, rate, and discover the best bubble tea spots with your friends.",
  manifest: "/manifest.json",
  themeColor: "#7C3AED",
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={nunito.variable}>
      <body className="bg-boba-bg font-nunito antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
