import { Pool, types } from 'pg'

// Колонки типа DATE отдаём как строку «ГГГГ-ММ-ДД», а не как объект Date.
// Иначе драйвер собирает Date на локальную полночь, и дальше любое
// приведение к строке (String(), JSON.stringify(), toISOString()) либо
// портит формат, либо сдвигает день на сутки в поясах с плюсовым смещением.
types.setTypeParser(1082, (v: string) => v)

let pool: Pool | null = null

function getPool() {
  if (!pool && process.env.DATABASE_URL) {
    pool = new Pool({ connectionString: process.env.DATABASE_URL })
  }
  return pool
}

export async function dbArtworks() {
  const p = getPool()!
  const { rows } = await p.query('SELECT * FROM artworks ORDER BY art_id')
  return rows
}

export async function dbArtworksPublished() {
  const p = getPool()!
  const { rows } = await p.query(
    'SELECT * FROM artworks WHERE in_catalog = true ORDER BY art_id'
  )
  return rows
}

export async function dbArtworkById(id: string) {
  const p = getPool()!
  const { rows } = await p.query('SELECT * FROM artworks WHERE id = $1', [id])
  return rows[0] || null
}

export async function dbArtworkUpsert(data: Record<string, unknown>) {
  const p = getPool()!
  const { rows } = await p.query(
    `INSERT INTO artworks (art_id, title, author, technique, materials, size, year, status, desc_short, curator_text, image_url, thumb_url, in_catalog, category)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
     ON CONFLICT (art_id) DO UPDATE SET
       title=$2, author=$3, technique=$4, materials=$5, size=$6, year=$7,
       status=$8, desc_short=$9, curator_text=$10,
       image_url=CASE WHEN $11='' THEN artworks.image_url ELSE $11 END,
       thumb_url=CASE WHEN $12='' THEN artworks.thumb_url ELSE $12 END,
       in_catalog=$13, category=$14
     RETURNING *`,
    [data.art_id, data.title, data.author, data.technique, data.materials,
     data.size, data.year, data.status, data.desc_short, data.curator_text,
     data.image_url || '', data.thumb_url || '', data.in_catalog, data.category]
  )
  return rows[0]
}

export async function dbArtworkDelete(id: string) {
  const p = getPool()!
  await p.query('DELETE FROM artworks WHERE id = $1', [id])
}

export async function dbArtworkToggle(id: string, val: boolean) {
  const p = getPool()!
  await p.query('UPDATE artworks SET in_catalog=$1 WHERE id=$2', [val, id])
}

export async function dbEvents() {
  const p = getPool()!
  const { rows } = await p.query('SELECT * FROM events ORDER BY event_date DESC NULLS LAST')
  return rows
}

export async function dbEventsPublished() {
  const p = getPool()!
  const { rows } = await p.query(
    'SELECT * FROM events WHERE published=true ORDER BY event_date ASC NULLS LAST'
  )
  return rows
}

export async function dbEventById(id: string) {
  const p = getPool()!
  const { rows } = await p.query('SELECT * FROM events WHERE id=$1', [id])
  return rows[0] || null
}

export async function dbEventUpsert(data: Record<string, unknown>, id?: string) {
  const p = getPool()!
  if (id) {
    const { rows } = await p.query(
      `UPDATE events SET title=$1, type=$2, event_date=$3, place=$4, description=$5, link=$6,
       image_url=CASE WHEN $7='' THEN image_url ELSE $7 END,
       thumb_url=CASE WHEN $8='' THEN thumb_url ELSE $8 END,
       published=$9 WHERE id=$10 RETURNING *`,
      [data.title, data.type, data.event_date || null, data.place, data.description,
       data.link, data.image_url || '', data.thumb_url || '', data.published, id]
    )
    return rows[0]
  }
  const { rows } = await p.query(
    `INSERT INTO events (title, type, event_date, place, description, link, image_url, thumb_url, published)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [data.title, data.type, data.event_date || null, data.place, data.description,
     data.link, data.image_url || '', data.thumb_url || '', data.published]
  )
  return rows[0]
}

export async function dbEventDelete(id: string) {
  const p = getPool()!
  await p.query('DELETE FROM events WHERE id=$1', [id])
}

export async function dbEventToggle(id: string, val: boolean) {
  const p = getPool()!
  await p.query('UPDATE events SET published=$1 WHERE id=$2', [val, id])
}
