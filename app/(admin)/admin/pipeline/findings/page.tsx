'use client'
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { PipelineShell, Badge, VERDICT_COLOR, btn, btnGold, muted, th, td, fmtDate, usd, input } from '@/components/admin/PipelineShell'

type Finding = {
  id: number; url: string; title: string; summary: string; published_at: string | null; found_at: string
  score: string | null; verdict: string; verdict_reason: string; model_cost: string; via: string | null; topic: string | null
  judge: Record<string, unknown> | null; source_name: string | null; authority: number | null; draft_id: number | null
}

const VERDICTS = ['', 'new', 'accepted', 'rejected', 'duplicate']
const VERDICT_LABEL: Record<string, string> = { '': 'все', new: 'новые', accepted: 'принятые', rejected: 'отклонённые', duplicate: 'дубли' }

export default function FindingsPage() {
  const [rows, setRows] = useState<Finding[]>([])
  const [verdict, setVerdict] = useState('new')
  const [open, setOpen] = useState<number | null>(null)
  const [addUrl, setAddUrl] = useState('')
  const [err, setErr] = useState('')

  const load = useCallback(async () => {
    const r = await fetch(`/api/admin/pipeline/findings${verdict ? `?verdict=${verdict}` : ''}`)
    const j = await r.json()
    if (!r.ok) setErr(j.error); else setRows(j)
  }, [verdict])

  useEffect(() => { load() }, [load])

  async function setVerdictOf(id: number, v: 'accepted' | 'rejected') {
    await fetch(`/api/admin/pipeline/findings/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ verdict: v }) })
    setRows(prev => prev.map(r => r.id === id ? { ...r, verdict: v } : r))
  }

  async function add() {
    if (!addUrl) return
    const r = await fetch('/api/admin/pipeline/findings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: addUrl }) })
    const j = await r.json()
    if (!r.ok) { setErr(j.error); return }
    setAddUrl('')
    setVerdict('accepted')
  }

  return (
    <PipelineShell title={`Находки (${rows.length})`}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' }}>
        {VERDICTS.map(v => (
          <button key={v} onClick={() => setVerdict(v)} style={{ ...btn, color: v === verdict ? '#c9a84c' : '#888', borderColor: v === verdict ? '#c9a84c' : '#333' }}>{VERDICT_LABEL[v]}</button>
        ))}
        <div style={{ flex: 1 }} />
        <input value={addUrl} onChange={e => setAddUrl(e.target.value)} placeholder="https://… вставить ссылку вручную (сразу в принятые)" style={{ ...input, width: 420 }} />
        <button onClick={add} style={btnGold}>Добавить</button>
      </div>
      {err && <div style={{ color: '#e66', marginBottom: 12 }}>{err}</div>}
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr style={{ borderBottom: '1px solid #222' }}>{['найдено', 'источник', 'материал', 'оценка', 'вердикт', ''].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
        <tbody>
          {rows.map(r => (
            <FindingRow key={r.id} r={r} open={open === r.id} toggle={() => setOpen(open === r.id ? null : r.id)} onVerdict={setVerdictOf} />
          ))}
        </tbody>
      </table>
      {rows.length === 0 && <div style={{ ...muted, marginTop: 20 }}>Пусто.</div>}
    </PipelineShell>
  )
}

function FindingRow({ r, open, toggle, onVerdict }: { r: Finding; open: boolean; toggle: () => void; onVerdict: (id: number, v: 'accepted' | 'rejected') => void }) {
  const j = (r.judge || {}) as Record<string, number | string>
  return (
    <>
      <tr style={{ borderBottom: open ? 'none' : '1px solid #161616', cursor: 'pointer' }} onClick={toggle}>
        <td style={{ ...td, color: '#666', whiteSpace: 'nowrap' }}>{fmtDate(r.found_at)}<br /><span style={{ fontSize: '0.7rem' }}>{r.via === 'rss' ? 'лента' : r.via === 'manual' ? 'вручную' : 'поиск'}</span></td>
        <td style={{ ...td, color: '#888', maxWidth: 160 }}>{r.source_name || hostOf(r.url)}{r.authority ? <span style={{ color: '#c9a84c' }}> · {r.authority}/5</span> : ''}</td>
        <td style={{ ...td, maxWidth: 520 }}>
          <div style={{ color: '#ddd' }}>{r.title || r.url}</div>
          <div style={{ ...muted, marginTop: 2 }}>{r.published_at ? fmtDate(r.published_at) + ' · ' : ''}{r.topic || ''}</div>
        </td>
        <td style={{ ...td, color: '#ccc', whiteSpace: 'nowrap' }}>{r.score != null ? Number(r.score).toFixed(1) : ''}</td>
        <td style={td}><Badge text={r.verdict} color={VERDICT_COLOR[r.verdict] || '#888'} /></td>
        <td style={{ ...td, whiteSpace: 'nowrap' }} onClick={e => e.stopPropagation()}>
          {r.verdict !== 'accepted' && <button onClick={() => onVerdict(r.id, 'accepted')} style={{ ...btn, color: '#4caf50', marginRight: 6 }}>принять</button>}
          {r.verdict !== 'rejected' && <button onClick={() => onVerdict(r.id, 'rejected')} style={{ ...btn, color: '#a55' }}>отклонить</button>}
          {r.draft_id && <Link href={`/admin/pipeline/drafts/${r.draft_id}`} style={{ color: '#c9a84c', marginLeft: 10, fontSize: '0.8rem' }}>черновик</Link>}
        </td>
      </tr>
      {open && (
        <tr style={{ borderBottom: '1px solid #161616' }}>
          <td colSpan={6} style={{ ...td, paddingTop: 0, paddingBottom: 16 }}>
            <div style={{ background: '#0f0f0f', border: '1px solid #1e1e1e', padding: '12px 16px', fontSize: '0.85rem' }}>
              <div><a href={r.url} target="_blank" rel="noreferrer" style={{ color: '#c9a84c', wordBreak: 'break-all' }}>{r.url}</a></div>
              {r.summary && <p style={{ color: '#bbb', lineHeight: 1.5 }}>{r.summary}</p>}
              {r.verdict_reason && <p style={{ color: '#999', whiteSpace: 'pre-wrap' }}>{r.verdict_reason}</p>}
              {r.judge && (
                <div style={muted}>
                  достоверность {j.credibility} · свежесть {j.freshness} · тема {j.relevance} · интерес {j.interest} · новизна {j.novelty}
                  {j.authority_bonus ? ` · бонус источника +${j.authority_bonus}` : ''} · порог {j.threshold}
                  {j.angle ? <div style={{ marginTop: 4, color: '#aaa' }}>угол: {j.angle}</div> : null}
                </div>
              )}
              <div style={{ ...muted, marginTop: 6 }}>стоимость оценки {usd(r.model_cost)}</div>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

function hostOf(url: string) {
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return url }
}
