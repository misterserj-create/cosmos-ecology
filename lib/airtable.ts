import * as fs from 'fs'
import * as path from 'path'

const TOKEN = process.env.AIRTABLE_TOKEN!
const APP_ID = process.env.AIRTABLE_APP_ID!
const TABLE_ID = process.env.AIRTABLE_TABLE_ID!
const EVENTS_TABLE_ID = 'tbl6JeW1z4f8XAyaz'

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
  const rawImageUrl = imgs[0]?.url || ''
  const proxyUrl = rawImageUrl ? `/api/proxy-image?url=${encodeURIComponent(rawImageUrl)}` : ''
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
    imageUrl: proxyUrl,
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

  const records: Artwork[] = []
  let offset: string | undefined

  try {
    do {
      const params = new URLSearchParams({ pageSize: '100' })
      if (offset) params.set('offset', offset)

      const res = await fetch(
        `https://api.airtable.com/v0/${APP_ID}/${TABLE_ID}?${params}`,
        {
          headers: { Authorization: `Bearer ${TOKEN}` },
          next: { revalidate: 300 },
        }
      )

      if (!res.ok) {
        throw new Error(`Airtable error: ${res.status}`)
      }

      const data = await res.json()

      for (const rec of data.records || []) {
        records.push(parseArtworkRecord(rec))
      }

      offset = data.offset
    } while (offset)

    return records.sort((a, b) => a.artId.localeCompare(b.artId))
  } catch (error) {
    console.error('Failed to fetch artworks from Airtable, using cache:', error)
    const cachedRecords = loadCachedArtworks()
    return cachedRecords.map(parseArtworkRecord).sort((a, b) => a.artId.localeCompare(b.artId))
  }
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

function parseEventRecord(rec: any): Event {
  const f = rec.fields
  const imgs = f['Фото'] || []
  const rawImageUrl = imgs[0]?.url || ''
  const proxyUrl = rawImageUrl ? `/api/proxy-image?url=${encodeURIComponent(rawImageUrl)}` : ''
  return {
    id: rec.id,
    title: f['Название'] || '',
    type: f['Тип'] || '',
    date: f['Дата'] || '',
    place: f['Место'] || '',
    description: f['Описание'] || '',
    link: f['Ссылка'] || '',
    imageUrl: proxyUrl,
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

  try {
    const params = new URLSearchParams({
      pageSize: '100',
      filterByFormula: '{Опубликовать}=1',
      'sort[0][field]': 'Дата',
      'sort[0][direction]': 'asc',
    })

    const res = await fetch(
      `https://api.airtable.com/v0/${APP_ID}/${EVENTS_TABLE_ID}?${params}`,
      {
        headers: { Authorization: `Bearer ${TOKEN}` },
        cache: 'no-store',
      }
    )

    if (!res.ok) {
      throw new Error(`Airtable error: ${res.status}`)
    }

    const data = await res.json()
    return (data.records || []).map(parseEventRecord)
  } catch (error) {
    console.error('Failed to fetch events from Airtable, using cache:', error)
    const cachedRecords = loadCachedEvents()
    return cachedRecords.map(parseEventRecord)
  }
}
