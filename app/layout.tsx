import type { Metadata } from "next"
import { Playfair_Display, Inter } from "next/font/google"
import "./globals.css"

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin", "cyrillic"],
  weight: ["400", "700"],
  style: ["normal", "italic"],
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
    <html lang="ru" className={`${playfair.variable} ${inter.variable}`}>
      <body className="min-h-screen flex flex-col">{children}</body>
    </html>
  )
}
