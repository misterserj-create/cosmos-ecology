'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'

type Row = {
  id: number; slug: string; title: string; published: boolean;
  published_at: string | null; cover_url: string; source_tg_id: number | null
}

export default function JournalAdmin() {
  const [rows, setRows] = useState<Row[]>([])

  async function load() {
    const r = await fetch('/api/admin/journal')
    setRows(await r.json())
  }

  async function toggle(id: number, val: boolean) {
    await fetch(`/api/admin/journal/${id}`, {
      method: 'PATCH', body: JSON.stringify({ published: val }),
      headers: { 'Content-Type': 'application/json' },
    })
    setRows(prev => prev.map(r => r.id === id ? { ...r, published: val } : r))
  }

  useEffect(() => { load() }, [])

  return (
    <div style={page}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
        <div style={{ display:'flex', gap:24, alignItems:'center' }}>
          <h1 style={h1}>Журнал ({rows.length})</h1>
          <Link href="/admin/artworks" style={navLink}>→ Работы</Link>
          <Link href="/admin/events" style={navLink}>→ События</Link>
        </div>
        <Link href="/admin/journal/new" style={addBtn}>+ Добавить</Link>
      </div>

      <table style={{ width:'100%', borderCollapse:'collapse' }}>
        <thead>
          <tr style={{ borderBottom:'1px solid #222', textAlign:'left' }}>
            {['', 'Дата', 'Заголовок', 'Адрес', 'Опубликовано', ''].map((h, i) => (
              <th key={i} style={th}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.id} style={{ borderBottom:'1px solid #1a1a1a' }}>
              <td style={td}>
                {r.cover_url ? (
                  <img src={r.cover_url} alt="" style={{ width:56, height:56, objectFit:'cover' }} />
                ) : <div style={{ width:56, height:56, background:'#1a1a1a' }} />}
              </td>
              <td style={{ ...td, color:'#666', fontSize:'0.8rem', whiteSpace:'nowrap' }}>{r.published_at || ''}</td>
              <td style={td}>
                {r.title}
                {r.source_tg_id && <span style={{ color:'#444', fontSize:'0.75rem', marginLeft:8 }}>tg#{r.source_tg_id}</span>}
              </td>
              <td style={{ ...td, color:'#888', fontSize:'0.8rem' }}>
                <a href={`/journal/${r.slug}`} target="_blank" rel="noopener" style={{ color:'#888', textDecoration:'none' }}>/journal/{r.slug}</a>
              </td>
              <td style={td}>
                <button
                  onClick={() => toggle(r.id, !r.published)}
                  style={{ ...toggleBtn, background: r.published ? '#2d5a2d' : '#1a1a1a', color: r.published ? '#4caf50' : '#555' }}
                >
                  {r.published ? 'Да' : 'Нет'}
                </button>
              </td>
              <td style={td}>
                <Link href={`/admin/journal/${r.id}`} style={editLink}>Редактировать</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const page: React.CSSProperties = { minHeight:'100vh', background:'#080808', color:'#ddd', padding:'40px 32px', fontFamily:'sans-serif' }
const h1: React.CSSProperties = { margin:0, color:'#c9a84c', fontSize:'1.4rem' }
const th: React.CSSProperties = { padding:'8px 12px', color:'#555', fontSize:'0.8rem', fontWeight:400, letterSpacing:'0.1em' }
const td: React.CSSProperties = { padding:'8px 12px', verticalAlign:'middle' }
const toggleBtn: React.CSSProperties = { border:'none', padding:'4px 12px', cursor:'pointer', fontSize:'0.8rem', borderRadius:2 }
const editLink: React.CSSProperties = { color:'#c9a84c', fontSize:'0.85rem', textDecoration:'none' }
const addBtn: React.CSSProperties = { background:'#c9a84c', color:'#000', padding:'8px 20px', textDecoration:'none', fontSize:'0.85rem', fontWeight:600 }
const navLink: React.CSSProperties = { color:'#555', fontSize:'0.9rem', textDecoration:'none' }
