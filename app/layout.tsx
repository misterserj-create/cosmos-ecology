import type { Metadata } from "next"
import { PT_Sans_Narrow, Inter } from "next/font/google"
import "./globals.css"

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
  title: "Экология Космоса 2026",
  description:
    "Выставка об актуальных вопросах техногенного воздействия на околоземную орбиту и проблеме космического мусора.",
  openGraph: {
    title: "Экология Космоса 2026",
    description: "Выставочный проект к 65-летию полёта Юрия Гагарина",
    locale: "ru_RU",
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className={`${condensed.variable} ${inter.variable}`}>
      <body className="min-h-screen flex flex-col">{children}</body>
    </html>
  )
}
