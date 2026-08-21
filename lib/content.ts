/**
 * Чтение работ и событий. Основной источник - PostgreSQL (lib/db.ts),
 * запасной - снимок в public/cache, который выручает, когда база недоступна.
 *
 * Файл назывался lib/airtable.ts: проект начинался на Airtable, и записи в
 * кэше до сих пор лежат в его формате, с русскими именами полей. Самого
 * Airtable в проекте нет с тех пор, как данные переехали в PostgreSQL и
 * MinIO, поэтому имя переименовано по смыслу, а не по происхождению.
 */
import * as fs from 'fs'
import * as path from 'path'
import { defaultLocale, type Locale } from '@/i18n/config'
import {
  CATEGORY_LABELS,
  EVENT_TYPE_LABELS,
  STATUS_LABELS,
  TECHNIQUE_LABELS,
  enumLabel,
} from '@/lib/site'

function loadCachedArtworks(): any[] {
  try {
    const cacheFile = path.join(process.cwd(), 'public', 'cache', 'artworks.json')
    if (fs.existsSync(cacheFile)) {
      return JSON.parse(fs.readFileSync(cacheFile, 'utf-8'))
    }
  } catch (e) {
    console.warn('Failed to load cached artworks:', e)
  }
  return []
}

function loadCachedEvents(): any[] {
  try {
    const cacheFile = path.join(process.cwd(), 'public', 'cache', 'events.json')
    if (fs.existsSync(cacheFile)) {
      return JSON.parse(fs.readFileSync(cacheFile, 'utf-8'))
    }
  } catch (e) {
    console.warn('Failed to load cached events:', e)
  }
  return []
}

export interface Artwork {
  id: string
  artId: string
  title: string
  author: string
  technique: string
  materials: string
  size: string
  year: number
  status: string
  descShort: string
  curatorText: string
  imageUrl: string
  inCatalog: boolean
  category: string
}

/**
 * Строка базы (или её снимок в кэше) - в работу для витрины.
 * Один и тот же вид данных у обоих источников: кэш это дословный снимок
 * выборки из PostgreSQL, а не выгрузка из чужой системы, как раньше.
 */
function toArtwork(r: Record<string, unknown>, locale: Locale): Artwork {
  return {
    id: String(r.id),
    artId: String(r.art_id || ''),
    title: String(r.title || ''),
    author: String(r.author || ''),
    technique: enumLabel(TECHNIQUE_LABELS, String(r.technique || ''), locale),
    materials: String(r.materials || ''),
    size: String(r.size || ''),
    year: Number(r.year) || 0,
    status: enumLabel(STATUS_LABELS, String(r.status || ''), locale),
    descShort: String(r.desc_short || ''),
    curatorText: String(r.curator_text || ''),
    imageUrl: String(r.thumb_url || r.image_url || ''),
    inCatalog: Boolean(r.in_catalog),
    category: enumLabel(CATEGORY_LABELS, String(r.category || ''), locale),
  }
}

/**
 * Работы для витрины. Язык влияет на два разных слоя:
 *
 *   - свободные тексты (название, материалы, описания) приходят уже
 *     наложенными в SQL: перевод есть - берётся перевод, нет - русский;
 *   - техника, статус и категория - перечисления, они переводятся здесь по
 *     словарю в коде, потому что значений на всю базу десяток.
 *
 * Запасной путь (локальный кэш) отдаёт свободные тексты по-русски: переводы
 * живут только в базе, и подменить их нечем. Перечисления он переводит - им
 * база не нужна.
 */
export async function fetchArtworks(locale: Locale = defaultLocale): Promise<Artwork[]> {
  // PostgreSQL — основной источник когда DATABASE_URL задан
  if (process.env.DATABASE_URL) {
    try {
      const { dbArtworksPublished } = await import('./db')
      const rows = await dbArtworksPublished(locale)
      return rows
        .map((r: Record<string, unknown>) => toArtwork(r, locale))
        .sort((a: Artwork, b: Artwork) => a.artId.localeCompare(b.artId))
    } catch (e) {
      console.error('DB fetch failed, falling back to cache:', e)
    }
  }

  // Запасной путь: снимок выборки в public/cache
  return loadCachedArtworks()
    .filter(r => r.in_catalog)
    .map(r => toArtwork(r, locale))
    .sort((a, b) => a.artId.localeCompare(b.artId))
}

export interface Event {
  id: string
  title: string
  type: string
  date: string
  place: string
  description: string
  link: string
  imageUrl: string
}

// Дату приводим к «ГГГГ-ММ-ДД». Из PostgreSQL приходит либо строка (см.
// setTypeParser в lib/db.ts), либо объект Date, если парсер обойдён. У Date
// берём локальные поля, а не toISOString(): в поясе GMT+3 полночь 15 апреля
// в UTC это ещё 14-е, и день уехал бы на сутки назад.
function toIsoDate(value: unknown): string {
  if (!value) return ''
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return ''
    const y = value.getFullYear()
    const m = String(value.getMonth() + 1).padStart(2, '0')
    const d = String(value.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
  return String(value).slice(0, 10)
}

/** Строка базы (или её снимок в кэше) - в событие для витрины. */
function toEvent(r: Record<string, unknown>, locale: Locale): Event {
  return {
    id: String(r.id),
    title: String(r.title || ''),
    type: enumLabel(EVENT_TYPE_LABELS, String(r.type || ''), locale),
    date: toIsoDate(r.event_date),
    place: String(r.place || ''),
    description: String(r.description || ''),
    link: String(r.link || ''),
    imageUrl: String(r.thumb_url || r.image_url || ''),
  }
}

export async function fetchEvents(locale: Locale = defaultLocale): Promise<Event[]> {
  // PostgreSQL — основной источник когда DATABASE_URL задан
  if (process.env.DATABASE_URL) {
    try {
      const { dbEventsPublished } = await import('./db')
      const rows = await dbEventsPublished(locale)
      return rows.map((r: Record<string, unknown>) => toEvent(r, locale))
    } catch (e) {
      console.error('DB events fetch failed, falling back:', e)
    }
  }

  // Запасной путь: снимок выборки в public/cache
  return loadCachedEvents().map(r => toEvent(r, locale))
}
