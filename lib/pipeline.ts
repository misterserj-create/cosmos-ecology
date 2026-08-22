import { Pool } from 'pg'
import { createHash } from 'crypto'
import type { NextRequest } from 'next/server'

/**
 * Доступ админки к контент-тракту (схема pipeline в cosmos_db).
 *
 * Свой пул, а не тот, что в lib/db.ts: у тракта свой search_path, и таблицы
 * сайта ему не нужны. Все функции только читают и правят статусы и
 * настройки; сами этапы (сбор, отбор, тексты, публикация) крутятся
 * Python-скриптами на хосте, админка их не запускает.
 */

let pool: Pool | null = null

function getPool() {
  if (!pool) {
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL не задан')
    pool = new Pool({ connectionString: process.env.DATABASE_URL })
    pool.on('connect', client => {
      client.query('SET search_path TO pipeline, public').catch(() => {})
    })
  }
  return pool
}

async function q<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
  const r = await getPool().query(sql, params)
  return r.rows as T[]
}

/**
 * Проверка входа для API тракта. proxy.ts защищает страницы /admin, а
 * /api пропускает как есть, поэтому здесь сверяем ту же куку сами.
 */
export function isAdmin(req: NextRequest): boolean {
  const token = req.cookies.get('admin_token')?.value
  const expected = createHash('sha256').update(process.env.ADMIN_PASSWORD || 'cosmos2026').digest('hex')
  return token === expected
}

// ── Обзор ────────────────────────────────────────────────────────────────

export async function pipeOverview() {
  const [runs, costs, counts, failures, lastByStage] = await Promise.all([
    q(`SELECT id, stage, started_at, finished_at, ok, items_in, items_out, cost
       FROM pipe_runs ORDER BY started_at DESC LIMIT 30`),
    q(`SELECT
         COALESCE(SUM(cost_usd) FILTER (WHERE created_at > NOW() - INTERVAL '1 day'), 0)   AS day,
         COALESCE(SUM(cost_usd) FILTER (WHERE created_at > NOW() - INTERVAL '7 days'), 0)  AS week,
         COALESCE(SUM(cost_usd) FILTER (WHERE created_at > NOW() - INTERVAL '30 days'), 0) AS month,
         COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') AS calls_week
       FROM pipe_api_calls`),
    q(`SELECT
         (SELECT COUNT(*) FROM pipe_findings)                                AS findings,
         (SELECT COUNT(*) FROM pipe_findings WHERE verdict = 'new')          AS findings_new,
         (SELECT COUNT(*) FROM pipe_findings WHERE verdict = 'accepted')     AS findings_accepted,
         (SELECT COUNT(*) FROM pipe_drafts WHERE lang = 'ru')                AS drafts,
         (SELECT COUNT(*) FROM pipe_drafts WHERE lang = 'ru' AND status = 'review')    AS drafts_review,
         (SELECT COUNT(*) FROM pipe_drafts WHERE lang = 'ru' AND status = 'approved')  AS drafts_approved,
         (SELECT COUNT(*) FROM pipe_drafts WHERE lang = 'ru' AND status = 'published') AS drafts_published,
         (SELECT COUNT(*) FROM pipe_drafts WHERE lang <> 'ru')               AS translations,
         (SELECT COUNT(*) FROM pipe_sources WHERE kind = 'rss' AND active)   AS feeds`),
    q(`SELECT id, stage, started_at, log FROM pipe_runs
       WHERE ok = false ORDER BY started_at DESC LIMIT 5`),
    q(`SELECT DISTINCT ON (stage) stage, started_at, finished_at, ok, items_in, items_out, cost
       FROM pipe_runs ORDER BY stage, started_at DESC`),
  ])
  const byModel = await q(`SELECT model, COUNT(*) AS calls, SUM(cost_usd) AS cost
    FROM pipe_api_calls WHERE created_at > NOW() - INTERVAL '30 days'
    GROUP BY model ORDER BY cost DESC`)
  return { runs, costs: costs[0], counts: counts[0], failures, lastByStage, byModel }
}

// ── Находки ──────────────────────────────────────────────────────────────

export async function pipeFindings(verdict: string | null, limit = 200) {
  const where = verdict ? `WHERE f.verdict = $1` : ''
  const params = verdict ? [verdict, limit] : [limit]
  return q(
    `SELECT f.id, f.url, f.title, f.summary, f.published_at, f.found_at, f.score, f.verdict,
            f.verdict_reason, f.model_cost, f.raw->>'via' AS via, f.raw->>'topic' AS topic,
            f.raw->'judge' AS judge, s.name AS source_name, s.authority,
            (SELECT d.id FROM pipe_drafts d WHERE d.finding_id = f.id AND d.lang = 'ru' LIMIT 1) AS draft_id
     FROM pipe_findings f LEFT JOIN pipe_sources s ON s.id = f.source_id
     ${where} ORDER BY f.found_at DESC LIMIT $${params.length}`,
    params,
  )
}

export async function pipeFindingVerdict(id: number, verdict: 'accepted' | 'rejected', who = 'admin') {
  await q(
    `UPDATE pipe_findings SET verdict = $2, judged_at = NOW(),
       verdict_reason = CASE WHEN verdict_reason = '' THEN $3 ELSE verdict_reason || E'\n' || $3 END
     WHERE id = $1`,
    [id, verdict, `вручную (${who}): ${verdict}`],
  )
}

export async function pipeFindingAdd(url: string, title: string, topic: string) {
  const src = await q<{ id: number }>(
    `INSERT INTO pipe_sources (kind, query_or_url, topic, name) VALUES ('manual', 'admin', 'ручные ссылки', 'добавлено в админке')
     ON CONFLICT (kind, query_or_url) DO UPDATE SET topic = EXCLUDED.topic RETURNING id`,
  )
  const rows = await q(
    `INSERT INTO pipe_findings (source_id, url, title, raw, verdict, verdict_reason)
     VALUES ($1, $2, $3, $4::jsonb, 'accepted', 'добавлено вручную в админке')
     ON CONFLICT (url) DO NOTHING RETURNING id`,
    [src[0].id, url, title, JSON.stringify({ via: 'manual', topic })],
  )
  return rows[0] ?? null
}

// ── Черновики ────────────────────────────────────────────────────────────

export async function pipeDrafts(status: string | null, limit = 200) {
  const where = status ? `AND d.status = $1` : ''
  const params = status ? [status, limit] : [limit]
  return q(
    `SELECT d.id, d.finding_id, d.title, d.status, d.created_by, d.created_at, d.updated_at,
            d.reviewed_at, d.published_at, d.model_cost,
            d.quality->>'avg' AS quality_avg, d.quality->>'passed' AS quality_passed,
            d.fact_check->>'verdict' AS fact_verdict,
            jsonb_array_length(COALESCE(d.fact_check->'issues', '[]'::jsonb)) AS fact_issues,
            d.published_to,
            (SELECT string_agg(c.lang, ',' ORDER BY c.lang) FROM pipe_drafts c WHERE c.parent_id = d.id) AS langs,
            f.url AS source_url
     FROM pipe_drafts d LEFT JOIN pipe_findings f ON f.id = d.finding_id
     WHERE d.lang = 'ru' ${where} ORDER BY d.created_at DESC LIMIT $${params.length}`,
    params,
  )
}

export async function pipeDraft(id: number) {
  const rows = await q(
    `SELECT d.*, f.url AS source_url, f.title AS source_title, f.summary AS source_summary,
            f.raw->'judge' AS judge
     FROM pipe_drafts d LEFT JOIN pipe_findings f ON f.id = d.finding_id WHERE d.id = $1`,
    [id],
  )
  // image_url/image_prompt/image_cost приходят через SELECT *, отдельно доставать не нужно.
  if (!rows[0]) return null
  const translations = await q(
    `SELECT id, lang, body, status, quality, created_by, created_at FROM pipe_drafts WHERE parent_id = $1 ORDER BY lang`,
    [id],
  )
  return { ...rows[0], translations }
}

export type DraftAction = 'approve' | 'reject' | 'rewrite' | 'publish_now' | 'edit' | 'unpublish_flag' | 'regen_image'

export async function pipeDraftAction(id: number, action: DraftAction, payload: { body?: string; title?: string } = {}, who = 'admin') {
  switch (action) {
    case 'approve':
      await q(`UPDATE pipe_drafts SET status = 'approved', reviewed_by = $2, reviewed_at = NOW() WHERE id = $1`, [id, who])
      break
    case 'reject':
      await q(`UPDATE pipe_drafts SET status = 'rejected', reviewed_by = $2, reviewed_at = NOW() WHERE id = $1`, [id, who])
      break
    case 'rewrite':
      // write.py подхватит черновик при следующем прогоне и перепишет
      await q(
        `UPDATE pipe_drafts SET status = 'draft', reviewed_by = $2, reviewed_at = NOW(),
           quality = quality || jsonb_build_object('rewrite_requested', true, 'rewrite_requested_at', NOW()::text)
         WHERE id = $1`,
        [id, who],
      )
      break
    case 'publish_now':
      // Публикует publish.py (крон каждые 30 минут). Здесь только одобрение
      // и пометка, чтобы в списке было видно, что ждём публикации.
      await q(
        `UPDATE pipe_drafts SET status = 'approved', reviewed_by = $2, reviewed_at = NOW(),
           published_to = published_to || jsonb_build_object('publish_now', NOW()::text)
         WHERE id = $1 AND status <> 'published'`,
        [id, who],
      )
      break
    case 'edit':
      await q(
        `UPDATE pipe_drafts SET body = COALESCE($2, body), title = COALESCE($3, title),
           quality = quality || jsonb_build_object('edited_by', $4::text, 'edited_at', NOW()::text)
         WHERE id = $1`,
        [id, payload.body ?? null, payload.title ?? null, who],
      )
      break
    case 'unpublish_flag':
      await q(`UPDATE pipe_drafts SET published_to = published_to - 'publish_now' WHERE id = $1`, [id])
      break
    case 'regen_image':
      // Сайт крутится в контейнере, illustrate.py - на хосте (тот же приём,
      // что у publish_now): здесь только сброс, картинку сделает ближайший
      // прогон крона или python3 illustrate.py --draft N руками.
      await q(
        `UPDATE pipe_drafts SET image_url = NULL, image_prompt = NULL, image_cost = NULL WHERE id = $1`,
        [id],
      )
      break
  }
}

// ── Настройки и источники ────────────────────────────────────────────────

export async function pipeSettings() {
  const rows = await q<{ key: string; value: unknown; updated_at: string }>(`SELECT key, value, updated_at FROM pipe_settings ORDER BY key`)
  const out: Record<string, unknown> = {}
  for (const r of rows) out[r.key] = r.value
  return out
}

export async function pipeSettingsSave(values: Record<string, unknown>) {
  for (const [key, value] of Object.entries(values)) {
    await q(
      `INSERT INTO pipe_settings (key, value) VALUES ($1, $2::jsonb)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [key, JSON.stringify(value)],
    )
  }
}

export async function pipeSources() {
  return q(`SELECT id, kind, query_or_url, name, organization, topic, feed_kind, authority, active, last_run_at, last_error,
            (SELECT COUNT(*) FROM pipe_findings f WHERE f.source_id = s.id) AS findings
     FROM pipe_sources s ORDER BY kind, authority DESC, name`)
}

export async function pipeSourceToggle(id: number, active: boolean) {
  await q(`UPDATE pipe_sources SET active = $2 WHERE id = $1`, [id, active])
}

export async function pipeRunLog(id: number) {
  const rows = await q(`SELECT * FROM pipe_runs WHERE id = $1`, [id])
  if (!rows[0]) return null
  const calls = await q(`SELECT purpose, model, prompt_tokens, completion_tokens, cost_usd, ok, error, created_at
    FROM pipe_api_calls WHERE run_id = $1 ORDER BY id`, [id])
  return { ...rows[0], calls }
}
