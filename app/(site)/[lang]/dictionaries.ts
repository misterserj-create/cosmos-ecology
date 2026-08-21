/**
 * Загрузка словарей. Обычный JSON и динамический import() - без библиотек
 * вроде next-intl: на сайте одна страница, и весь текст нужен серверу разом.
 *
 * Любой язык накладывается поверх русского: чего в переводе ещё нет, то
 * показывается по-русски. Пока переводов нет вовсе, шесть словарей просто
 * повторяют русский, и запасной вариант ни на что не влияет - но он не даст
 * странице развалиться, когда переводы начнут заливать по частям.
 */

import type { Locale } from "@/i18n/config"
import { defaultLocale } from "@/i18n/config"
import type ruDictionary from "@/i18n/dictionaries/ru.json"

export type Dictionary = typeof ruDictionary

const loaders: Record<Locale, () => Promise<unknown>> = {
  ru: () => import("@/i18n/dictionaries/ru.json").then(m => m.default),
  en: () => import("@/i18n/dictionaries/en.json").then(m => m.default),
  es: () => import("@/i18n/dictionaries/es.json").then(m => m.default),
  zh: () => import("@/i18n/dictionaries/zh.json").then(m => m.default),
  fr: () => import("@/i18n/dictionaries/fr.json").then(m => m.default),
  de: () => import("@/i18n/dictionaries/de.json").then(m => m.default),
  ja: () => import("@/i18n/dictionaries/ja.json").then(m => m.default),
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

/** Глубокое наложение перевода на русский: пустые и отсутствующие ключи берутся из базы. */
function withFallback<T>(base: T, override: unknown): T {
  if (isPlainObject(base) && isPlainObject(override)) {
    const result: Record<string, unknown> = { ...base }
    for (const key of Object.keys(base)) {
      result[key] = withFallback((base as Record<string, unknown>)[key], override[key])
    }
    return result as T
  }
  if (override === undefined || override === null || override === "") return base
  if (Array.isArray(base) && !Array.isArray(override)) return base
  return override as T
}

export async function getDictionary(locale: Locale): Promise<Dictionary> {
  const base = (await loaders[defaultLocale]()) as Dictionary
  if (locale === defaultLocale) return base
  const translated = await loaders[locale]()
  return withFallback(base, translated)
}
