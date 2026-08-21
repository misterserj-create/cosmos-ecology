import type { MetadataRoute } from "next"
import { SITE_URL } from "@/lib/site"
import { alternateLanguages, localePath, locales } from "@/i18n/config"

/**
 * По записи на каждый язык, и в каждой - полный набор alternates.
 * Поисковику нужно видеть связку во все стороны, иначе он считает языковые
 * версии независимыми страницами с похожим текстом.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const absolute = (path: string) => (path === "/" ? SITE_URL : `${SITE_URL}${path}`)

  const languages: Record<string, string> = {}
  for (const [key, path] of Object.entries(alternateLanguages())) {
    languages[key] = absolute(path)
  }

  const lastModified = new Date()

  return locales.map(locale => ({
    url: absolute(localePath(locale)),
    lastModified,
    changeFrequency: "weekly",
    priority: locale === "ru" ? 1 : 0.8,
    alternates: { languages },
  }))
}
