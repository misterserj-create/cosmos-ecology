'use client'
import { Suspense, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { PipelineShell, Badge, STATUS_COLOR, STATUS_LABEL, btn, muted, th, td, fmtDate, usd } from '@/components/admin/PipelineShell'

type Draft = {
  id: number; title: string; status: string; created_by: string; created_at: string; reviewed_at: string | null
  published_at: string | null; model_cost: string; quality_avg: string | null; quality_passed: string | null
  fact_verdict: string | null; fact_issues: number; published_to: Record<string, { ok?: boolean; url?: string; error?: string }>
  langs: string | null; source_url: string | null
}

const STATUSES = ['', 'review', 'approved', 'published', 'draft', 'rejected']

export default function DraftsPage() {
  return <Suspense fallback={null}><DraftsInner /></Suspense>
}

function DraftsInner() {
  const params = useSearchParams()
  const [status, setStatus] = useState(params.get('status') ?? 'review')
  const [rows, setRows] = useState<Draft[]>([])
  const [err, setErr] = useState('')

  const load = useCallback(async () => {
    const r = await fetch(`/api/admin/pipeline/drafts${status ? `?status=${status}` : ''}`)
    const j = await r.json()
    if (!r.ok) setErr(j.error); else setRows(j)
  }, [status])
  useEffect(() => { load() }, [load])

  async function act(id: number, action: string) {
    await fetch(`/api/admin/pipeline/drafts/${id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) })
    load()
  }

  return (
    <PipelineShell title={`Черновики (${rows.length})`}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {STATUSES.map(s => (
          <button key={s} onClick={() => setStatus(s)} style={{ ...btn, color: s === status ? '#c9a84c' : '#888', borderColor: s === status ? '#c9a84c' : '#333' }}>{s ? STATUS_LABEL[s] : 'все'}</button>
        ))}
      </div>
      {err && <div style={{ color: '#e66', marginBottom: 12 }}>{err}</div>}
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr style={{ borderBottom: '1px solid #222' }}>{['создан', 'материал', 'качество', 'факты', 'переводы', 'статус', 'публикация', ''].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.id} style={{ borderBottom: '1px solid #161616' }}>
              <td style={{ ...td, color: '#666', whiteSpace: 'nowrap' }}>{fmtDate(r.created_at)}<br /><span style={{ fontSize: '0.7rem' }}>{usd(r.model_cost)}</span></td>
              <td style={{ ...td, maxWidth: 480 }}>
                <Link href={`/admin/pipeline/drafts/${r.id}`} style={{ color: '#ddd', textDecoration: 'none' }}>{r.title || `черновик ${r.id}`}</Link>
                <div style={{ ...muted, marginTop: 2 }}>{r.created_by}</div>
              </td>
              <td style={{ ...td, whiteSpace: 'nowrap' }}>
                {r.quality_avg != null ? <span style={{ color: r.quality_passed === 'true' ? '#4caf50' : '#e66' }}>{Number(r.quality_avg).toFixed(1)}</span> : <span style={muted}>–</span>}
              </td>
              <td style={td}>
                {r.fact_verdict ? <span style={{ color: r.fact_verdict === 'ok' ? '#4caf50' : '#e66' }}>{r.fact_verdict === 'ok' ? 'ok' : `расхождений ${r.fact_issues}`}</span> : <span style={muted}>–</span>}
              </td>
              <td style={{ ...td, color: '#888', fontSize: '0.8rem' }}>{r.langs || <span style={muted}>нет</span>}</td>
              <td style={td}><Badge text={STATUS_LABEL[r.status] || r.status} color={STATUS_COLOR[r.status] || '#888'} /></td>
              <td style={{ ...td, fontSize: '0.8rem' }}>
                {Object.entries(r.published_to || {}).filter(([k]) => k === 'tg' || k === 'vk').map(([k, v]) => (
                  <div key={k}>{v.ok && v.url ? <a href={v.url} target="_blank" rel="noreferrer" style={{ color: '#5b9bd5' }}>{k}</a> : <span style={{ color: '#e66' }} title={v.error}>{k}: ошибка</span>}</div>
                ))}
                {r.published_to?.publish_now && r.status === 'approved' && <span style={{ color: '#c9a84c' }}>ждёт прогона</span>}
              </td>
              <td style={{ ...td, whiteSpace: 'nowrap' }}>
                {(r.status === 'review' || r.status === 'draft') && <button onClick={() => act(r.id, 'approve')} style={{ ...btn, color: '#4caf50', marginRight: 6 }}>одобрить</button>}
                {r.status !== 'published' && r.status !== 'rejected' && <button onClick={() => act(r.id, 'reject')} style={{ ...btn, color: '#a55' }}>отклонить</button>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && <div style={{ ...muted, marginTop: 20 }}>Пусто.</div>}
    </PipelineShell>
  )
}
