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

function parseArtworkRecord(rec: any, locale: Locale): Artwork {
  const f = rec.fields
  const imgs = f['Изображение'] || []
  return {
    id: rec.id,
    artId: f['ID'] || '',
    title: f['Название'] || '',
    author: f['Автор'] || '',
    technique: enumLabel(TECHNIQUE_LABELS, f['Техника'] || '', locale),
    materials: f['Материалы'] || '',
    size: f['Габариты (см)'] || '',
    year: f['Год'] || 0,
    status: enumLabel(STATUS_LABELS, f['Статус'] || '', locale),
    descShort: f['Описание (короткое)'] || '',
    curatorText: f['Кураторский текст'] || '',
    imageUrl: imgs[0]?.url || '',
    inCatalog: f['В каталог'] === true,
    category: enumLabel(CATEGORY_LABELS, f['Категория'] || '', locale),
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
      return rows.map((r: Record<string, unknown>) => ({
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
      })).sort((a: Artwork, b: Artwork) => a.artId.localeCompare(b.artId))
    } catch (e) {
      console.error('DB fetch failed, falling back to cache:', e)
    }
  }

  // Fallback — локальный JSON-кэш (Airtable выведен из проекта)
  return loadCachedArtworks()
    .map(rec => parseArtworkRecord(rec, locale))
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

function parseEventRecord(rec: any, locale: Locale): Event {
  const f = rec.fields
  const imgs = f['Фото'] || []
  return {
    id: rec.id,
    title: f['Название'] || '',
    type: enumLabel(EVENT_TYPE_LABELS, f['Тип'] || '', locale),
    date: f['Дата'] || '',
    place: f['Место'] || '',
    description: f['Описание'] || '',
    link: f['Ссылка'] || '',
    imageUrl: imgs[0]?.url || '',
  }
}

export async function fetchEvents(locale: Locale = defaultLocale): Promise<Event[]> {
  // PostgreSQL — основной источник когда DATABASE_URL задан
  if (process.env.DATABASE_URL) {
    try {
      const { dbEventsPublished } = await import('./db')
      const rows = await dbEventsPublished(locale)
      return rows.map((r: Record<string, unknown>) => ({
        id: String(r.id),
        title: String(r.title || ''),
        type: enumLabel(EVENT_TYPE_LABELS, String(r.type || ''), locale),
        date: r.event_date ? String(r.event_date).slice(0, 10) : '',
        place: String(r.place || ''),
        description: String(r.description || ''),
        link: String(r.link || ''),
        imageUrl: String(r.thumb_url || r.image_url || ''),
      }))
    } catch (e) {
      console.error('DB events fetch failed, falling back:', e)
    }
  }

  // Fallback — локальный JSON-кэш (Airtable выведен из проекта)
  return loadCachedEvents().map(rec => parseEventRecord(rec, locale))
}
