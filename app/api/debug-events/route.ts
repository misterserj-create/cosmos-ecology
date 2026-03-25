export const dynamic = 'force-dynamic'

export async function GET() {
  const TOKEN = process.env.AIRTABLE_TOKEN
  const APP_ID = process.env.AIRTABLE_APP_ID

  if (!TOKEN || !APP_ID) {
    return Response.json({ error: 'Missing env vars', TOKEN: !!TOKEN, APP_ID: !!APP_ID })
  }

  const params = new URLSearchParams({
    filterByFormula: '{Опубликовать}=1',
  })

  const res = await fetch(
    `https://api.airtable.com/v0/${APP_ID}/tbl6JeW1z4f8XAyaz?${params}`,
    { headers: { Authorization: `Bearer ${TOKEN}` } }
  )

  const data = await res.json()
  return Response.json({ status: res.status, records: data.records?.length ?? 0, data })
}
