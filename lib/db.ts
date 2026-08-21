import { Pool, types } from 'pg'
import { defaultLocale, type Locale } from '@/i18n/config'
import {
  ARTWORK_TRANSLATABLE,
  EVENT_TRANSLATABLE,
  artworkSourceHash,
  eventSourceHash,
  isTranslationLocale,
  translationLocales,
  type TranslationLocale,
} from '@/lib/translations'

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

/**
 * Кусок SELECT с наложением перевода. Русский - источник истины, поэтому
 * COALESCE берёт перевод только если он есть и непустой: NULLIF гасит
 * пустую строку, а она в таблице переводов бывает часто (название перевели,
 * кураторский текст ещё нет).
 */
function translatedColumns(alias: string, fields: readonly string[]) {
  return fields.map(f => `COALESCE(NULLIF(t.${f}, ''), ${alias}.${f}) AS ${f}`).join(', ')
}

// ── Работы ───────────────────────────────────────────────────────────────

export async function dbArtworks() {
  const p = getPool()!
  const { rows } = await p.query('SELECT * FROM artworks ORDER BY art_id')
  return rows
}

/**
 * Работы для витрины на выбранном языке.
 *
 * Русский идёт прежним запросом без соединения - и потому, что соединять
 * не с чем (строк с lang='ru' в таблице переводов нет), и потому, что это
 * самый частый запрос на сайте.
 */
export async function dbArtworksPublished(locale: Locale = defaultLocale) {
  const p = getPool()!
  if (locale === defaultLocale || !isTranslationLocale(locale)) {
    const { rows } = await p.query(
      'SELECT * FROM artworks WHERE in_catalog = true ORDER BY art_id'
    )
    return rows
  }
  const { rows } = await p.query(
    `SELECT a.id, a.art_id, a.author, a.technique, a.size, a.year, a.status,
            a.image_url, a.thumb_url, a.in_catalog, a.category, a.created_at,
            ${translatedColumns('a', ARTWORK_TRANSLATABLE)}
       FROM artworks a
       LEFT JOIN artwork_translations t
         ON t.artwork_id = a.id AND t.lang = $1
      WHERE a.in_catalog = true
      ORDER BY a.art_id`,
    [locale]
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

// ── События ──────────────────────────────────────────────────────────────

export async function dbEvents() {
  const p = getPool()!
  const { rows } = await p.query('SELECT * FROM events ORDER BY event_date DESC NULLS LAST')
  return rows
}

export async function dbEventsPublished(locale: Locale = defaultLocale) {
  const p = getPool()!
  if (locale === defaultLocale || !isTranslationLocale(locale)) {
    const { rows } = await p.query(
      'SELECT * FROM events WHERE published=true ORDER BY event_date ASC NULLS LAST'
    )
    return rows
  }
  const { rows } = await p.query(
    `SELECT e.id, e.type, e.event_date, e.link, e.image_url, e.thumb_url,
            e.published, e.published_tg, e.created_at,
            ${translatedColumns('e', EVENT_TRANSLATABLE)}
       FROM events e
       LEFT JOIN event_translations t
         ON t.event_id = e.id AND t.lang = $1
      WHERE e.published = true
      ORDER BY e.event_date ASC NULLS LAST`,
    [locale]
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

// ── Переводы для админки ─────────────────────────────────────────────────

export type TranslationRow = {
  stale: boolean
  updatedAt: string | null
  fields: Record<string, string>
}

function blankTranslation(fields: readonly string[]): TranslationRow {
  const values: Record<string, string> = {}
  for (const f of fields) values[f] = ''
  return { stale: false, updatedAt: null, fields: values }
}

/**
 * Все переводы одной сущности, по одному на язык, вместе с признаком
 * «перевод устарел». Устарел - значит русский текст правили после того, как
 * перевод записали: отпечаток оригинала перестал совпадать.
 */
async function loadTranslations(
  table: string,
  idColumn: string,
  id: string,
  fields: readonly string[],
  currentHash: string
): Promise<Record<TranslationLocale, TranslationRow>> {
  const p = getPool()!
  const { rows } = await p.query(`SELECT * FROM ${table} WHERE ${idColumn} = $1`, [id])

  const result = {} as Record<TranslationLocale, TranslationRow>
  for (const lang of translationLocales) result[lang] = blankTranslation(fields)

  for (const row of rows) {
    const lang = String(row.lang)
    if (!isTranslationLocale(lang)) continue
    const item = blankTranslation(fields)
    for (const f of fields) item.fields[f] = String(row[f] ?? '')
    // Пустой перевод устаревшим не считаем: устаревать ещё нечему.
    const hasText = fields.some(f => item.fields[f].trim() !== '')
    item.stale = hasText && String(row.source_hash || '') !== currentHash
    item.updatedAt = row.updated_at ? new Date(row.updated_at).toISOString() : null
    result[lang] = item
  }
  return result
}

export async function dbArtworkTranslations(id: string) {
  const source = await dbArtworkById(id)
  if (!source) return null
  const sourceHash = artworkSourceHash(source)
  return {
    sourceHash,
    translations: await loadTranslations(
      'artwork_translations', 'artwork_id', id, ARTWORK_TRANSLATABLE, sourceHash
    ),
  }
}

export async function dbEventTranslations(id: string) {
  const source = await dbEventById(id)
  if (!source) return null
  const sourceHash = eventSourceHash(source)
  return {
    sourceHash,
    translations: await loadTranslations(
      'event_translations', 'event_id', id, EVENT_TRANSLATABLE, sourceHash
    ),
  }
}

/**
 * Запись перевода. Отпечаток берётся не из запроса, а считается тут же по
 * свежей русской строке: перевод, который сохранили сейчас, по определению
 * сделан с того текста, который сейчас в базе.
 */
async function saveTranslation(
  table: string,
  idColumn: string,
  id: string,
  lang: string,
  fields: readonly string[],
  values: Record<string, unknown>,
  sourceHash: string
) {
  const p = getPool()!
  const cols = [idColumn, 'lang', ...fields, 'source_hash']
  const params: unknown[] = [id, lang, ...fields.map(f => String(values[f] ?? '')), sourceHash]
  const placeholders = params.map((_, i) => `$${i + 1}`).join(', ')
  const updates = [...fields, 'source_hash'].map(c => `${c} = EXCLUDED.${c}`).join(', ')

  await p.query(
    `INSERT INTO ${table} (${cols.join(', ')}, updated_at)
     VALUES (${placeholders}, NOW())
     ON CONFLICT (${idColumn}, lang) DO UPDATE SET ${updates}, updated_at = NOW()`,
    params
  )
}

export async function dbArtworkTranslationSave(
  id: string, lang: string, values: Record<string, unknown>
) {
  if (!isTranslationLocale(lang)) throw new Error(`Нет такого языка перевода: ${lang}`)
  const source = await dbArtworkById(id)
  if (!source) throw new Error(`Работа ${id} не найдена`)
  await saveTranslation(
    'artwork_translations', 'artwork_id', id, lang,
    ARTWORK_TRANSLATABLE, values, artworkSourceHash(source)
  )
}

export async function dbEventTranslationSave(
  id: string, lang: string, values: Record<string, unknown>
) {
  if (!isTranslationLocale(lang)) throw new Error(`Нет такого языка перевода: ${lang}`)
  const source = await dbEventById(id)
  if (!source) throw new Error(`Событие ${id} не найдено`)
  await saveTranslation(
    'event_translations', 'event_id', id, lang,
    EVENT_TRANSLATABLE, values, eventSourceHash(source)
  )
}
