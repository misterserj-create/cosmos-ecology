/**
 * Список языков сайта и всё, что от языка зависит технически:
 * атрибут lang, локаль для чисел и дат, локаль для Open Graph, адрес страницы.
 *
 * Русский - основной язык и живёт по адресу без префикса ("/"), потому что
 * этот адрес уже проиндексирован. Остальные языки получают префикс: /en, /ja.
 */

export const locales = ["ru", "en", "es", "zh", "fr", "de", "ja"] as const

export type Locale = (typeof locales)[number]

export const defaultLocale: Locale = "ru"

/** Название языка на нём самом - для переключателя в шапке. */
export const localeNames: Record<Locale, string> = {
  ru: "Русский",
  en: "English",
  es: "Español",
  zh: "中文",
  fr: "Français",
  de: "Deutsch",
  ja: "日本語",
}

/** Короткая подпись в переключателе: заглавными, вразрядку. */
export const localeShort: Record<Locale, string> = {
  ru: "RU",
  en: "EN",
  es: "ES",
  zh: "ZH",
  fr: "FR",
  de: "DE",
  ja: "JA",
}

/** Значение атрибута lang у <html> и ключ для hreflang. */
export const htmlLang: Record<Locale, string> = {
  ru: "ru",
  en: "en",
  es: "es",
  zh: "zh-Hans",
  fr: "fr",
  de: "de",
  ja: "ja",
}

/** Локаль для Intl: разделители разрядов, дробная часть. */
export const intlLocale: Record<Locale, string> = {
  ru: "ru-RU",
  en: "en-US",
  es: "es-ES",
  zh: "zh-CN",
  fr: "fr-FR",
  de: "de-DE",
  ja: "ja-JP",
}

/** Локаль для Open Graph. */
export const ogLocale: Record<Locale, string> = {
  ru: "ru_RU",
  en: "en_US",
  es: "es_ES",
  zh: "zh_CN",
  fr: "fr_FR",
  de: "de_DE",
  ja: "ja_JP",
}

export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value)
}

/**
 * Адрес страницы на выбранном языке. Русский без префикса, остальные с ним.
 * Путь передаётся без языка: localePath("en", "/") -> "/en".
 */
export function localePath(locale: Locale, path = "/"): string {
  const clean = path === "/" ? "" : path.startsWith("/") ? path : `/${path}`
  if (locale === defaultLocale) return clean || "/"
  return `/${locale}${clean}`
}

/** Карта hreflang для metadata.alternates.languages. */
export function alternateLanguages(path = "/"): Record<string, string> {
  const map: Record<string, string> = {}
  for (const locale of locales) map[htmlLang[locale]] = localePath(locale, path)
  map["x-default"] = localePath(defaultLocale, path)
  return map
}
