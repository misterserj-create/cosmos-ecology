const TOKEN = process.env.AIRTABLE_TOKEN!
const APP_ID = process.env.AIRTABLE_APP_ID!
const TABLE_ID = process.env.AIRTABLE_TABLE_ID!
const EVENTS_TABLE_ID = 'tbl6JeW1z4f8XAyaz'

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

export async function fetchArtworks(): Promise<Artwork[]> {
  const records: Artwork[] = []
  let offset: string | undefined

  do {
    const params = new URLSearchParams({ pageSize: '100' })
    if (offset) params.set('offset', offset)

    const res = await fetch(
      `https://api.airtable.com/v0/${APP_ID}/${TABLE_ID}?${params}`,
      {
        headers: { Authorization: `Bearer ${TOKEN}` },
        next: { revalidate: 300 }, // кэш 5 минут
      }
    )

    const data = await res.json()

    for (const rec of data.records || []) {
      const f = rec.fields
      const imgs = f['Изображение'] || []
      records.push({
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
      })
    }

    offset = data.offset
  } while (offset)

  return records.sort((a, b) => a.artId.localeCompare(b.artId))
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

export async function fetchEvents(): Promise<Event[]> {
  const params = new URLSearchParams({
    pageSize: '100',
    filterByFormula: '{Опубликовать}=1',
    sort: JSON.stringify([{ field: 'Дата', direction: 'asc' }]),
  })

  const res = await fetch(
    `https://api.airtable.com/v0/${APP_ID}/${EVENTS_TABLE_ID}?${params}`,
    {
      headers: { Authorization: `Bearer ${TOKEN}` },
      cache: 'no-store',
    }
  )

  const data = await res.json()
  return (data.records || []).map((rec: any) => {
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
  })
}
