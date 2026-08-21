import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { PT_Sans_Narrow, Inter, Noto_Sans_SC, Noto_Sans_JP } from "next/font/google"
import "../../globals.css"
import { SITE_URL, SITE_NAME, buildJsonLd } from "@/lib/site"
import {
  alternateLanguages,
  htmlLang,
  isLocale,
  localePath,
  locales,
  ogLocale,
  type Locale,
} from "@/i18n/config"
import { getDictionary } from "./dictionaries"

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

// В PT Sans Narrow и Inter нет иероглифов и каны: на китайской и японской
// версиях браузер подставил бы что попало. Оба Noto подключаются только на
// своём языке и без preload - шрифты CJK весят слишком много, чтобы тянуть
// их вперёд остальной страницы.
const notoSC = Noto_Sans_SC({
  variable: "--font-cjk",
  weight: ["400", "700"],
  preload: false,
})

const notoJP = Noto_Sans_JP({
  variable: "--font-cjk",
  weight: ["400", "700"],
  preload: false,
})

export function generateStaticParams() {
  return locales.map(lang => ({ lang }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>
}): Promise<Metadata> {
  const { lang } = await params
  if (!isLocale(lang)) return {}
  const dict = await getDictionary(lang)

  return {
    // Оба домена отдают одну и ту же страницу. Каноническая ссылка на
    // латинский адрес: кириллический не набирается в чужой раскладке, а для
    // поисковика две копии без указания оригинала - дубль.
    metadataBase: new URL(SITE_URL),
    title: dict.meta.title,
    description: dict.meta.description,
    alternates: {
      canonical: localePath(lang),
      languages: alternateLanguages(),
    },
    openGraph: {
      type: "website",
      url: `${SITE_URL}${localePath(lang) === "/" ? "" : localePath(lang)}`,
      siteName: `${SITE_NAME} 2026`,
      title: dict.meta.title,
      description: dict.meta.description,
      locale: ogLocale[lang],
      images: [{ url: "/og.jpg", width: 1200, height: 630, alt: dict.meta.ogImageAlt }],
    },
    twitter: {
      card: "summary_large_image",
      title: dict.meta.title,
      description: dict.meta.description,
      images: ["/og.jpg"],
    },
  }
}

export default async function SiteLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ lang: string }>
}) {
  const { lang } = await params
  if (!isLocale(lang)) notFound()
  const locale: Locale = lang

  const cjk = locale === "zh" ? notoSC : locale === "ja" ? notoJP : null
  const classes = [condensed.variable, inter.variable, cjk?.variable]
    .filter(Boolean)
    .join(" ")

  return (
    <html
      lang={htmlLang[locale]}
      className={classes}
      // Заголовки и текст на китайском и японском отдаём Noto: подменяем
      // сами переменные шрифтов, а не правим каждый компонент.
      style={
        cjk
          ? ({
              "--font-display": "var(--font-cjk), sans-serif",
              "--font-body": "var(--font-cjk), sans-serif",
            } as React.CSSProperties)
          : undefined
      }
    >
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
