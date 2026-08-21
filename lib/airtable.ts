import * as fs from 'fs'
import * as path from 'path'

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

function parseArtworkRecord(rec: any): Artwork {
  const f = rec.fields
  const imgs = f['Изображение'] || []
  return {
    id: rec.id,
    artId: f['ID'] || '',
    title: f['Название'] || '',
    author: f['Автор'] || '',
    technique: f['Техника'] || '',
    materials: f['Материалы'] || '',
    size: f['Габариты (см)'] || '',
    year: f['Год'] || 0,
    status: f['Статус'] || '',
    descShort: f['Описание (короткое)'] || '',
    curatorText: f['Кураторский текст'] || '',
    imageUrl: imgs[0]?.url || '',
    inCatalog: f['В каталог'] === true,
    category: f['Категория'] || '',
  }
}

export async function fetchArtworks(): Promise<Artwork[]> {
  // PostgreSQL — основной источник когда DATABASE_URL задан
  if (process.env.DATABASE_URL) {
    try {
      const { dbArtworksPublished } = await import('./db')
      const rows = await dbArtworksPublished()
      return rows.map((r: Record<string, unknown>) => ({
        id: String(r.id),
        artId: String(r.art_id || ''),
        title: String(r.title || ''),
        author: String(r.author || ''),
        technique: String(r.technique || ''),
        materials: String(r.materials || ''),
        size: String(r.size || ''),
        year: Number(r.year) || 0,
        status: String(r.status || ''),
        descShort: String(r.desc_short || ''),
        curatorText: String(r.curator_text || ''),
        imageUrl: String(r.thumb_url || r.image_url || ''),
        inCatalog: Boolean(r.in_catalog),
        category: String(r.category || ''),
      })).sort((a: Artwork, b: Artwork) => a.artId.localeCompare(b.artId))
    } catch (e) {
      console.error('DB fetch failed, falling back to cache:', e)
    }
  }

  // Fallback — локальный JSON-кэш (Airtable выведен из проекта)
  return loadCachedArtworks().map(parseArtworkRecord).sort((a, b) => a.artId.localeCompare(b.artId))
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

function parseEventRecord(rec: any): Event {
  const f = rec.fields
  const imgs = f['Фото'] || []
  return {
    id: rec.id,
    title: f['Название'] || '',
    type: f['Тип'] || '',
    date: f['Дата'] || '',
    place: f['Место'] || '',
    description: f['Описание'] || '',
    link: f['Ссылка'] || '',
    imageUrl: imgs[0]?.url || '',
  }
}

export async function fetchEvents(): Promise<Event[]> {
  // PostgreSQL — основной источник когда DATABASE_URL задан
  if (process.env.DATABASE_URL) {
    try {
      const { dbEventsPublished } = await import('./db')
      const rows = await dbEventsPublished()
      return rows.map((r: Record<string, unknown>) => ({
        id: String(r.id),
        title: String(r.title || ''),
        type: String(r.type || ''),
        date: toIsoDate(r.event_date),
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
  return loadCachedEvents().map(parseEventRecord)
}
