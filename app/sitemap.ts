import type { MetadataRoute } from "next"
import { SITE_URL } from "@/lib/site"
import { fetchJournal } from "@/lib/content"
import { alternateLanguages, htmlLang, localePath, locales, defaultLocale } from "@/i18n/config"

/**
 * По записи на каждый язык, и в каждой - полный набор alternates.
 * Поисковику нужно видеть связку во все стороны, иначе он считает языковые
 * версии независимыми страницами с похожим текстом.
 *
 * Журнал: лента и каждая публикация. У публикации адреса по языкам разные
 * (переводной slug), поэтому alternates собираются из post.slugs, а не из
 * общего alternateLanguages().
 */
// Список публикаций меняется без пересборки - карта собирается на запрос.
export const dynamic = "force-dynamic"

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const absolute = (path: string) => (path === "/" ? SITE_URL : `${SITE_URL}${path}`)

  const languagesFor = (path: string) => {
    const languages: Record<string, string> = {}
    for (const [key, p] of Object.entries(alternateLanguages(path))) languages[key] = absolute(p)
    return languages
  }

  const lastModified = new Date()

  const home: MetadataRoute.Sitemap = locales.map(locale => ({
    url: absolute(localePath(locale)),
    lastModified,
    changeFrequency: "weekly",
    priority: locale === "ru" ? 1 : 0.8,
    alternates: { languages: languagesFor("/") },
  }))

  const journalIndex: MetadataRoute.Sitemap = locales.map(locale => ({
    url: absolute(localePath(locale, "/journal")),
    lastModified,
    changeFrequency: "weekly",
    priority: locale === "ru" ? 0.8 : 0.6,
    alternates: { languages: languagesFor("/journal") },
  }))

  // Русская лента несёт русские slug и карту переводных адресов - этого
  // хватает на все языки без шести лишних запросов.
  const posts = await fetchJournal(defaultLocale)
  const journalPosts: MetadataRoute.Sitemap = []
  for (const post of posts) {
    const languages: Record<string, string> = {}
    for (const l of locales) languages[htmlLang[l]] = absolute(localePath(l, `/journal/${post.slugs[l]}`))
    languages["x-default"] = languages[htmlLang[defaultLocale]]
    const modified = post.date ? new Date(post.date) : lastModified
    for (const locale of locales) {
      journalPosts.push({
        url: absolute(localePath(locale, `/journal/${post.slugs[locale]}`)),
        lastModified: modified,
        changeFrequency: "monthly",
        priority: locale === "ru" ? 0.7 : 0.5,
        alternates: { languages },
      })
    }
  }

  return [...home, ...journalIndex, ...journalPosts]
}
