import type { Metadata } from "next"
import { PT_Sans_Narrow, Inter } from "next/font/google"
import "./globals.css"
import { SITE_URL, SITE_NAME, SITE_DESCRIPTION, buildJsonLd } from "@/lib/site"

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
  // Оба домена отдают одну и ту же страницу. Каноническая ссылка на
  // латинский адрес: кириллический не набирается в чужой раскладке, а для
  // поисковика две копии без указания оригинала - дубль.
  metadataBase: new URL(SITE_URL),
  title: `${SITE_NAME} 2026`,
  description: SITE_DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: `${SITE_NAME} 2026`,
    title: `${SITE_NAME} 2026`,
    description: SITE_DESCRIPTION,
    locale: "ru_RU",
    images: [
      {
        url: "/og.jpg",
        width: 1200,
        height: 630,
        alt: "Земля с низкой орбиты, вокруг обломки космического мусора",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} 2026`,
    description: SITE_DESCRIPTION,
    images: ["/og.jpg"],
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className={`${condensed.variable} ${inter.variable}`}>
      <body className="min-h-screen flex flex-col">
        {children}
        <script
          type="application/ld+json"
          // Разметка выставки: четыре площадки с датами и адресами, чтобы
          // поисковик показывал карточку события, а не просто ссылку.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(buildJsonLd()) }}
        />
      </body>
    </html>
  )
}
