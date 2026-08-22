'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { PipelineShell, Badge, STAGE_LABEL, card, muted, th, td, fmtDate, usd, pre } from '@/components/admin/PipelineShell'

type Run = { id: number; stage: string; started_at: string; finished_at: string | null; ok: boolean | null; items_in: number; items_out: number; cost: string }
type Overview = {
  runs: Run[]
  lastByStage: Run[]
  costs: { day: string; week: string; month: string; calls_week: string }
  counts: Record<string, string>
  failures: { id: number; stage: string; started_at: string; log: string }[]
  byModel: { model: string; calls: string; cost: string }[]
}

export default function PipelineOverview() {
  const [data, setData] = useState<Overview | null>(null)
  const [err, setErr] = useState('')
  const [openLog, setOpenLog] = useState<number | null>(null)

  useEffect(() => {
    fetch('/api/admin/pipeline/overview').then(async r => {
      const j = await r.json()
      if (!r.ok) setErr(j.error || 'ошибка'); else setData(j)
    }).catch(e => setErr(String(e)))
  }, [])

  return (
    <PipelineShell title="Контент-тракт">
      {err && <div style={{ color: '#b3261e', marginBottom: 16 }}>Ошибка: {err}. Скорее всего, не применена миграция 004_pipeline.sql.</div>}
      {!data && !err && <div style={muted}>Загрузка…</div>}
      {data && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 28 }}>
            <Stat label="расход за день" value={usd(data.costs.day)} />
            <Stat label="за неделю" value={usd(data.costs.week)} sub={`${data.costs.calls_week} вызовов`} />
            <Stat label="за 30 дней" value={usd(data.costs.month)} />
            <Stat label="находок" value={data.counts.findings} sub={`новых ${data.counts.findings_new}, принято ${data.counts.findings_accepted}`} href="/admin/pipeline/findings" />
            <Stat label="черновиков" value={data.counts.drafts} sub={`на проверке ${data.counts.drafts_review}, одобрено ${data.counts.drafts_approved}`} href="/admin/pipeline/drafts?status=review" />
            <Stat label="опубликовано" value={data.counts.drafts_published} sub={`переводов ${data.counts.translations}`} href="/admin/pipeline/drafts?status=published" />
            <Stat label="лент включено" value={data.counts.feeds} href="/admin/pipeline/settings" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', gap: 24, alignItems: 'start' }}>
            <div>
              <h2 style={h2}>Последний прогон каждого этапа</h2>
              <table style={table}>
                <thead><tr style={trh}>{['этап', 'когда', 'итог', 'вход', 'выход', 'стоимость'].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
                <tbody>
                  {['collect', 'judge', 'write', 'translate', 'publish'].map(stage => {
                    const r = data.lastByStage.find(x => x.stage === stage)
                    return (
                      <tr key={stage} style={trb}>
                        <td style={td}>{STAGE_LABEL[stage] || stage}</td>
                        <td style={td}>{r ? fmtDate(r.started_at) : <span style={muted}>не запускался</span>}</td>
                        <td style={td}>{r && <RunOk r={r} />}</td>
                        <td style={td}>{r?.items_in ?? ''}</td>
                        <td style={td}>{r?.items_out ?? ''}</td>
                        <td style={td}>{r ? usd(r.cost) : ''}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>

              <h2 style={{ ...h2, marginTop: 32 }}>Последние 30 прогонов</h2>
              <table style={table}>
                <thead><tr style={trh}>{['#', 'этап', 'старт', 'длит.', 'итог', 'вход', 'выход', 'стоимость'].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
                <tbody>
                  {data.runs.map(r => (
                    <tr key={r.id} style={trb}>
                      <td style={{ ...td, color: '#6f6a61' }}><button onClick={() => setOpenLog(openLog === r.id ? null : r.id)} style={{ background: 'none', border: 'none', color: '#8a6d1f', cursor: 'pointer', padding: 0 }}>{r.id}</button></td>
                      <td style={td}>{STAGE_LABEL[r.stage] || r.stage}</td>
                      <td style={td}>{fmtDate(r.started_at)}</td>
                      <td style={td}>{duration(r)}</td>
                      <td style={td}><RunOk r={r} /></td>
                      <td style={td}>{r.items_in}</td>
                      <td style={td}>{r.items_out}</td>
                      <td style={td}>{usd(r.cost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {openLog !== null && <RunLog id={openLog} onClose={() => setOpenLog(null)} />}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              <div style={card}>
                <h2 style={{ ...h2, marginTop: 0 }}>Где упало</h2>
                {data.failures.length === 0 && <div style={muted}>Падений нет.</div>}
                {data.failures.map(f => (
                  <div key={f.id} style={{ marginBottom: 12 }}>
                    <div><Badge text={STAGE_LABEL[f.stage] || f.stage} color="#b3261e" /> <span style={muted}>{fmtDate(f.started_at)} · прогон {f.id}</span></div>
                    <div style={{ ...muted, color: '#4a463f', marginTop: 4, whiteSpace: 'pre-wrap', maxHeight: 90, overflow: 'hidden' }}>{lastLines(f.log)}</div>
                  </div>
                ))}
              </div>
              <div style={card}>
                <h2 style={{ ...h2, marginTop: 0 }}>Расход по моделям, 30 дней</h2>
                {data.byModel.length === 0 && <div style={muted}>Вызовов ещё не было.</div>}
                {data.byModel.map(m => (
                  <div key={m.model} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.05rem', padding: '3px 0', borderBottom: '1px solid #e6e3dc' }}>
                    <span style={{ color: '#3d3a34' }}>{m.model}</span>
                    <span><span style={muted}>{m.calls} × </span>{usd(m.cost)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </PipelineShell>
  )
}

function RunLog({ id, onClose }: { id: number; onClose: () => void }) {
  const [run, setRun] = useState<{ log: string; calls: { purpose: string; model: string; cost_usd: string; ok: boolean; error: string | null }[] } | null>(null)
  useEffect(() => { fetch(`/api/admin/pipeline/runs/${id}`).then(r => r.json()).then(setRun) }, [id])
  return (
    <div style={{ ...card, marginTop: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <strong style={{ color: '#8a6d1f' }}>Прогон {id}</strong>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#6f6a61', cursor: 'pointer' }}>закрыть</button>
      </div>
      {!run && <div style={muted}>Загрузка…</div>}
      {run && (
        <>
          <pre style={{ ...pre, fontSize: '1rem', color: '#3d3a34', maxHeight: 400, overflow: 'auto' }}>{run.log}</pre>
          {run.calls.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div style={muted}>Вызовы моделей: {run.calls.length}</div>
              {run.calls.map((c, i) => (
                <div key={i} style={{ fontSize: '1rem', color: c.ok ? '#5c574f' : '#b3261e' }}>
                  {c.purpose} · {c.model} · {usd(c.cost_usd)}{c.error ? ` · ${c.error}` : ''}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function RunOk({ r }: { r: Run }) {
  if (r.ok === null) return <Badge text="идёт" color="#c9a84c" />
  return r.ok ? <Badge text="ok" color="#2e7d32" /> : <Badge text="упал" color="#b3261e" />
}

function Stat({ label, value, sub, href }: { label: string; value: string | number; sub?: string; href?: string }) {
  const body = (
    <div style={card}>
      <div style={muted}>{label}</div>
      <div style={{ fontSize: '1.7rem', color: '#1f1d1a', margin: '4px 0' }}>{value}</div>
      {sub && <div style={{ ...muted, fontSize: '0.9rem' }}>{sub}</div>}
    </div>
  )
  return href ? <Link href={href} style={{ textDecoration: 'none', color: 'inherit' }}>{body}</Link> : body
}

function duration(r: Run) {
  if (!r.finished_at) return ''
  const s = Math.round((new Date(r.finished_at).getTime() - new Date(r.started_at).getTime()) / 1000)
  return s < 90 ? `${s} с` : `${Math.round(s / 60)} мин`
}

function lastLines(log: string) {
  const lines = (log || '').trim().split('\n')
  const errIdx = lines.findIndex(l => l.includes('ОШИБКА'))
  return (errIdx >= 0 ? lines.slice(errIdx, errIdx + 3) : lines.slice(-3)).join('\n')
}

const h2: React.CSSProperties = { color: '#4a463f', fontSize: '1.05rem', fontWeight: 400, letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 10px' }
const table: React.CSSProperties = { width: '100%', borderCollapse: 'collapse' }
const trh: React.CSSProperties = { borderBottom: '1px solid #d9d5cc' }
const trb: React.CSSProperties = { borderBottom: '1px solid #e6e3dc' }
