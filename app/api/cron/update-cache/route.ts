import { NextRequest, NextResponse } from 'next/server'
import * as fs from 'fs'
import * as path from 'path'

const TOKEN = process.env.AIRTABLE_TOKEN
const APP_ID = process.env.AIRTABLE_APP_ID
const TABLE_ID = process.env.AIRTABLE_TABLE_ID
const EVENTS_TABLE_ID = 'tbl6JeW1z4f8XAyaz'
const CRON_SECRET = process.env.CRON_SECRET

async function fetchAirtableTable(tableId: string, filterFormula?: string) {
  const records: any[] = []
  let offset: string | undefined

  do {
    const params = new URLSearchParams({ pageSize: '100' })
    if (offset) params.set('offset', offset)
    if (filterFormula) params.set('filterByFormula', filterFormula)

    const res = await fetch(
      `https://api.airtable.com/v0/${APP_ID}/${tableId}?${params}`,
      { headers: { Authorization: `Bearer ${TOKEN}` } }
    )

    if (!res.ok) {
      throw new Error(`Airtable error: ${res.status}`)
    }

    const data = await res.json()
    records.push(...(data.records || []))
    offset = data.offset
  } while (offset)

  return records
}

export async function GET(request: NextRequest) {
  // Проверка авторизации (Vercel передаёт x-vercel-cron header)
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const [artworks, events] = await Promise.all([
      fetchAirtableTable(TABLE_ID!),
      fetchAirtableTable(EVENTS_TABLE_ID, '{Опубликовать}=1'),
    ])

    const cacheDir = path.join(process.cwd(), 'public', 'cache')
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true })
    }

    fs.writeFileSync(
      path.join(cacheDir, 'artworks.json'),
      JSON.stringify(artworks, null, 2)
    )
    fs.writeFileSync(
      path.join(cacheDir, 'events.json'),
      JSON.stringify(events, null, 2)
    )

    return NextResponse.json({
      success: true,
      message: `Cache updated: ${artworks.length} artworks, ${events.length} events`,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Cache update failed:', error)
    return NextResponse.json(
      { error: 'Failed to update cache', details: String(error) },
      { status: 500 }
    )
  }
}
