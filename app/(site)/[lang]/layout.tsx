import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { PT_Sans_Narrow, Inter } from "next/font/google"
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

// В PT Sans Narrow и Inter нет иероглифов и каны. Сначала здесь стояли
// Noto Sans SC и JP из next/font/google, но это оказалось плохой опорой:
// у Noto SC сотни файлов-подмножеств, и сборка целиком зависела от того,
// ответит ли fonts.gstatic.com. Один сбой сети - и сборка падает, в том
// числе на сервере при выкладке.
//
// Собственные шрифты не нужны: на китайском и японском устройстве системный
// шрифт (PingFang, Hiragino, Noto, Microsoft YaHei) заведомо есть и выглядит
// привычнее любого подставленного. Браузер подставляет его по глифам сам -
// нужно только назвать его в списке после фирменных.
const CJK_STACK =
  '"PingFang SC", "Hiragino Sans", "Hiragino Kaku Gothic ProN", ' +
  '"Noto Sans CJK SC", "Noto Sans SC", "Noto Sans JP", ' +
  '"Microsoft YaHei", "Yu Gothic", "Meiryo", sans-serif'

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

  const cjk = locale === "zh" || locale === "ja"
  const classes = [condensed.variable, inter.variable].join(" ")

  return (
    <html
      lang={htmlLang[locale]}
      className={classes}
      // Системный шрифт CJK идёт вторым в списке: латиница и кириллица
      // остаются в фирменных PT Sans Narrow и Inter, а иероглифы и кана,
      // которых в них нет, подхватываются по глифам. Правим переменные
      // шрифтов, а не каждый компонент по отдельности.
      style={
        cjk
          ? ({
              "--font-display": `var(--font-condensed), ${CJK_STACK}`,
              "--font-body": `var(--font-inter), ${CJK_STACK}`,
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
