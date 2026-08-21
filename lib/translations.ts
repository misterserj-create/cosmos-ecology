/**
 * Общая часть переводов текстов из базы: какие поля переводятся и как
 * считается отпечаток русского оригинала.
 *
 * Файл серверный - тянет crypto. Админка (клиентский компонент) пометку
 * «перевод устарел» сама не считает, ей приходит готовый признак из API.
 */

import { createHash } from "crypto"
import { locales, defaultLocale, type Locale } from "@/i18n/config"

/**
 * Языки, которые живут в таблицах переводов. Русский туда не пишется:
 * он остаётся в artworks и events как источник истины.
 */
export type TranslationLocale = Exclude<Locale, "ru">

export const translationLocales = locales.filter(
  (l): l is TranslationLocale => l !== defaultLocale
)

export function isTranslationLocale(value: string): value is TranslationLocale {
  return (translationLocales as readonly string[]).includes(value)
}

/**
 * Переводимые поля. Порядок задаёт отпечаток оригинала и менять его нельзя:
 * перестановка полей объявит устаревшими сразу все переводы в базе.
 *
 * Автор и габариты сюда не входят: имена не переводятся, а «75×40» одинаково
 * читается на всех семи языках. Техника, статус и категория - перечисления,
 * их переводы лежат в lib/site.ts.
 */
export const ARTWORK_TRANSLATABLE = ["title", "materials", "desc_short", "curator_text"] as const
export const EVENT_TRANSLATABLE = ["title", "place", "description"] as const

export type ArtworkTranslatableField = (typeof ARTWORK_TRANSLATABLE)[number]
export type EventTranslatableField = (typeof EVENT_TRANSLATABLE)[number]

/** Разделитель единиц: в текстах работ он не встречается, склейка однозначна. */
const UNIT_SEPARATOR = "\u001F"

function hashFields(row: Record<string, unknown>, fields: readonly string[]): string {
  const joined = fields.map(f => String(row?.[f] ?? "")).join(UNIT_SEPARATOR)
  return createHash("sha256").update(joined, "utf8").digest("hex")
}

/** Отпечаток русского оригинала работы. */
export function artworkSourceHash(row: Record<string, unknown>): string {
  return hashFields(row, ARTWORK_TRANSLATABLE)
}

/** Отпечаток русского оригинала события. */
export function eventSourceHash(row: Record<string, unknown>): string {
  return hashFields(row, EVENT_TRANSLATABLE)
}
