'use client'
import { use, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { PipelineShell, Badge, STATUS_COLOR, STATUS_LABEL, btn, btnGold, btnRed, card, muted, pre, fmtDate, usd, input } from '@/components/admin/PipelineShell'

type Judge = { avg?: number; comments?: string[]; error?: string; language?: number; cliches?: number; coherence?: number; voice?: number }
type Quality = {
  avg?: number | null; min?: number; passed?: boolean; judges?: Record<string, Judge>
  writer?: { model?: string; words?: number; cost?: number }; dash_fixed?: boolean; rewrite_rounds?: number
  history?: { step: string; body: string }[]; rewrite_requested?: boolean; edited_at?: string
}
type FactCheck = { verdict?: string; note?: string; issues?: { claim: string; problem: string; severity: string }[]; rounds?: number; first?: FactCheck }
type Translation = { id: number; lang: string; body: string; status: string; created_by: string; quality: { native?: { avg?: number; comments?: string[] }; passed?: boolean } }
type Draft = {
  id: number; title: string; body: string; status: string; lang: string; created_by: string; created_at: string; reviewed_by: string | null
  reviewed_at: string | null; published_at: string | null; model_cost: string; quality: Quality; fact_check: FactCheck
  published_to: Record<string, { ok?: boolean; url?: string; error?: string; needs_check?: boolean } | string>
  source_url: string | null; source_title: string | null; source_summary: string | null; judge: { angle?: string; reason?: string } | null
  translations: Translation[]
}

const LANG_NAMES: Record<string, string> = { ru: 'Русский', en: 'English', es: 'Español', fr: 'Français', de: 'Deutsch', zh: '中文', ja: '日本語' }

export default function DraftPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [d, setD] = useState<Draft | null>(null)
  const [tab, setTab] = useState('ru')
  const [editing, setEditing] = useState(false)
  const [body, setBody] = useState('')
  const [title, setTitle] = useState('')
  const [msg, setMsg] = useState('')

  const load = useCallback(async () => {
    const r = await fetch(`/api/admin/pipeline/drafts/${id}`)
    const j = await r.json()
    if (!r.ok) { setMsg(j.error); return }
    setD(j); setBody(j.body); setTitle(j.title)
  }, [id])
  useEffect(() => { load() }, [load])

  async function act(action: string, payload: Record<string, unknown> = {}) {
    setMsg('')
    const r = await fetch(`/api/admin/pipeline/drafts/${id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, ...payload }) })
    const j = await r.json()
    if (!r.ok) { setMsg(j.error); return }
    setEditing(false)
    await load()
    if (action === 'publish_now') setMsg('Одобрено и помечено к публикации. Публикует publish.py по крону (каждые 30 минут).')
    if (action === 'rewrite') setMsg('Помечено на переписывание. write.py перепишет при следующем прогоне (07:00) или вручную: python3 write.py')
  }

  if (!d) return <PipelineShell title="Черновик">{msg ? <div style={{ color: '#e66' }}>{msg}</div> : <div style={muted}>Загрузка…</div>}</PipelineShell>

  const q = d.quality || {}
  const fc = d.fact_check || {}
  const current = tab === 'ru' ? null : d.translations.find(t => t.lang === tab)
  const canEdit = tab === 'ru' && d.status !== 'published'

  return (
    <PipelineShell
      title={d.title || `Черновик ${d.id}`}
      right={<Link href="/admin/pipeline/drafts" style={{ color: '#666', textDecoration: 'none', fontSize: '0.9rem' }}>← Черновики</Link>}
    >
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 20 }}>
        <Badge text={STATUS_LABEL[d.status] || d.status} color={STATUS_COLOR[d.status] || '#888'} />
        <span style={muted}>{d.created_by} · {fmtDate(d.created_at)} · {usd(d.model_cost)}</span>
        {d.reviewed_by && <span style={muted}>· проверил {d.reviewed_by} {fmtDate(d.reviewed_at)}</span>}
        {q.rewrite_requested && d.status === 'draft' && <Badge text="ждёт переписывания" color="#c9a84c" />}
        {q.dash_fixed && <Badge text="длинное тире заменено" color="#776" />}
        <div style={{ flex: 1 }} />
        {d.status !== 'published' && d.status !== 'rejected' && <button onClick={() => act('approve')} style={{ ...btn, color: '#4caf50' }}>Одобрить</button>}
        {d.status !== 'published' && <button onClick={() => act('rewrite')} style={btn}>Переписать</button>}
        {d.status !== 'published' && <button onClick={() => act('publish_now')} style={btnGold}>Опубликовать сейчас</button>}
        {d.status !== 'published' && d.status !== 'rejected' && <button onClick={() => act('reject')} style={btnRed}>Отклонить</button>}
      </div>
      {msg && <div style={{ color: '#c9a84c', marginBottom: 16, fontSize: '0.85rem' }}>{msg}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 3fr) minmax(280px, 2fr)', gap: 24, alignItems: 'start' }}>
        <div>
          <div style={{ display: 'flex', gap: 2, marginBottom: 12, flexWrap: 'wrap' }}>
            {['ru', ...d.translations.map(t => t.lang)].map(l => (
              <button key={l} onClick={() => { setTab(l); setEditing(false) }} style={{ ...btn, color: tab === l ? '#c9a84c' : '#777', borderColor: tab === l ? '#c9a84c' : '#333' }}>
                {LANG_NAMES[l] || l}
              </button>
            ))}
            {d.translations.length === 0 && <span style={{ ...muted, alignSelf: 'center', marginLeft: 8 }}>переводов нет: появятся после одобрения (translate.py)</span>}
          </div>

          <div style={card}>
            {tab === 'ru' ? (
              editing ? (
                <>
                  <input value={title} onChange={e => setTitle(e.target.value)} style={{ ...input, marginBottom: 10 }} placeholder="Заголовок (служебный)" />
                  <textarea value={body} onChange={e => setBody(e.target.value)} style={{ ...input, height: 420, lineHeight: 1.5, fontFamily: 'inherit' }} />
                  <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    <button onClick={() => act('edit', { body, title })} style={btnGold}>Сохранить</button>
                    <button onClick={() => { setEditing(false); setBody(d.body); setTitle(d.title) }} style={btn}>Отмена</button>
                    {body.includes('—') && <span style={{ color: '#e66', fontSize: '0.8rem', alignSelf: 'center' }}>в тексте длинное тире «—», нужно «–»</span>}
                  </div>
                </>
              ) : (
                <>
                  <pre style={pre}>{d.body}</pre>
                  <div style={{ ...muted, marginTop: 12 }}>
                    {q.writer?.words ? `${q.writer.words} слов · ` : ''}{wordCount(d.body)} слов сейчас
                    {canEdit && <button onClick={() => setEditing(true)} style={{ ...btn, marginLeft: 12 }}>Править</button>}
                  </div>
                </>
              )
            ) : current ? (
              <>
                <pre style={pre}>{current.body}</pre>
                <div style={{ ...muted, marginTop: 12 }}>
                  {current.created_by} · оценка носителя {current.quality?.native?.avg ?? '–'}{current.quality?.passed === false ? ' (ниже порога)' : ''}
                </div>
                {(current.quality?.native?.comments || []).length > 0 && (
                  <ul style={{ ...muted, marginTop: 8, paddingLeft: 18 }}>{current.quality!.native!.comments!.map((c, i) => <li key={i}>{c}</li>)}</ul>
                )}
              </>
            ) : null}
          </div>

          {Object.keys(d.published_to || {}).some(k => k === 'tg' || k === 'vk') && (
            <div style={{ ...card, marginTop: 16 }}>
              <div style={h3}>Публикация</div>
              {Object.entries(d.published_to).filter(([k]) => k === 'tg' || k === 'vk').map(([k, v]) => typeof v === 'string' ? null : (
                <div key={k} style={{ fontSize: '0.85rem', marginBottom: 4 }}>
                  <strong style={{ color: '#aaa' }}>{k}</strong>:{' '}
                  {v.ok ? <a href={v.url} target="_blank" rel="noreferrer" style={{ color: '#5b9bd5' }}>{v.url || 'опубликовано'}</a> : <span style={{ color: '#e66' }}>{v.error}{v.needs_check ? ' (проверить канал вручную, возможен дубль)' : ''}</span>}
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={card}>
            <div style={h3}>Источник</div>
            {d.source_url && <a href={d.source_url} target="_blank" rel="noreferrer" style={{ color: '#c9a84c', fontSize: '0.85rem', wordBreak: 'break-all' }}>{d.source_title || d.source_url}</a>}
            {d.source_summary && <p style={{ ...muted, color: '#999', lineHeight: 1.5 }}>{d.source_summary}</p>}
            {d.judge?.angle && <div style={muted}>угол: {d.judge.angle}</div>}
          </div>

          <div style={card}>
            <div style={h3}>Судьи качества {q.avg != null && <span style={{ color: q.passed ? '#4caf50' : '#e66' }}>{Number(q.avg).toFixed(1)}</span>} <span style={muted}>порог {q.min}</span></div>
            {Object.entries(q.judges || {}).map(([model, j]) => (
              <div key={model} style={{ marginBottom: 10 }}>
                <div style={{ fontSize: '0.8rem', color: '#aaa' }}>{model}: {j.error ? <span style={{ color: '#e66' }}>{j.error}</span> : <>{j.avg} <span style={muted}>(язык {j.language}, штампы {j.cliches}, связность {j.coherence}, голос {j.voice})</span></>}</div>
                {(j.comments || []).length > 0 && <ul style={{ ...muted, paddingLeft: 18, margin: '4px 0' }}>{j.comments!.map((c, i) => <li key={i}>{c}</li>)}</ul>}
              </div>
            ))}
            {q.rewrite_rounds ? <div style={muted}>переписываний: {q.rewrite_rounds}</div> : null}
            {!q.judges && <div style={muted}>оценок нет</div>}
          </div>

          <div style={card}>
            <div style={h3}>Фактчек <span style={{ color: fc.verdict === 'ok' ? '#4caf50' : fc.verdict ? '#e66' : '#666' }}>{fc.verdict || 'нет'}</span></div>
            {fc.note && <div style={{ ...muted, marginBottom: 6 }}>{fc.note}</div>}
            {(fc.issues || []).map((i, n) => (
              <div key={n} style={{ fontSize: '0.8rem', marginBottom: 6, borderLeft: `2px solid ${i.severity === 'high' ? '#e66' : '#665'}`, paddingLeft: 8 }}>
                <div style={{ color: '#ccc' }}>{i.claim}</div>
                <div style={muted}>{i.problem}</div>
              </div>
            ))}
            {fc.first && <div style={muted}>до правки: расхождений {(fc.first.issues || []).length}, после: {(fc.issues || []).length}</div>}
          </div>

          {(q.history || []).length > 0 && (
            <details style={card}>
              <summary style={{ ...h3, cursor: 'pointer' }}>Прежние версии ({q.history!.length})</summary>
              {q.history!.map((h, i) => (
                <div key={i} style={{ marginTop: 10 }}>
                  <div style={muted}>{h.step}</div>
                  <pre style={{ ...pre, fontSize: '0.8rem', color: '#888' }}>{h.body}</pre>
                </div>
              ))}
            </details>
          )}
        </div>
      </div>
    </PipelineShell>
  )
}

function wordCount(s: string) { return (s.match(/[\p{L}\p{N}'’-]+/gu) || []).length }

const h3: React.CSSProperties = { color: '#999', fontSize: '0.75rem', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }
