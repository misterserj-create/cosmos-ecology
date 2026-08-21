import type { Metadata } from "next"
import { PT_Sans_Narrow, Inter } from "next/font/google"
import "../globals.css"

/**
 * Свой корневой макет для админки. Она не переводится и живёт вне
 * языковых адресов, поэтому lang="ru" зашит намертво, а поисковику
 * страницы админки не нужны.
 */

const condensed = PT_Sans_Narrow({
  variable: "--font-condensed",
  subsets: ["latin", "cyrillic"],
  weight: ["400", "700"],
})

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "cyrillic"],
  weight: ["300", "400"],
})

export const metadata: Metadata = {
  title: "Экология Космоса · Админ",
  robots: { index: false, follow: false },
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className={`${condensed.variable} ${inter.variable}`}>
      <body className="min-h-screen flex flex-col">{children}</body>
    </html>
  )
}
