'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'

type Row = {
  id: number; art_id: string; title: string; author: string;
  thumb_url: string; image_url: string; in_catalog: boolean; category: string
}

export default function ArtworksAdmin() {
  const [rows, setRows] = useState<Row[]>([])

  async function load() {
    const r = await fetch('/api/admin/artworks')
    setRows(await r.json())
  }

  async function toggle(id: number, val: boolean) {
    await fetch(`/api/admin/artworks/${id}`, {
      method: 'PATCH', body: JSON.stringify({ in_catalog: val }),
      headers: { 'Content-Type': 'application/json' },
    })
    setRows(prev => prev.map(r => r.id === id ? { ...r, in_catalog: val } : r))
  }

  useEffect(() => { load() }, [])

  return (
    <div style={page}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
        <div style={{ display:'flex', gap:24, alignItems:'center' }}>
          <h1 style={h1}>Работы ({rows.length})</h1>
          <Link href="/admin/events" style={navLink}>→ События</Link>
          <Link href="/admin/journal" style={navLink}>→ Журнал</Link>
          <Link href="/admin/pipeline" style={navLink}>→ Тракт</Link>
        </div>
        <Link href="/admin/artworks/new" style={addBtn}>+ Добавить</Link>
      </div>

      <table style={{ width:'100%', borderCollapse:'collapse' }}>
        <thead>
          <tr style={{ borderBottom:'1px solid #d9d5cc', textAlign:'left' }}>
            {['', 'ID', 'Название', 'Автор', 'В галерею', ''].map(h => (
              <th key={h} style={th}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.id} style={{ borderBottom:'1px solid #ffffff' }}>
              <td style={td}>
                {(r.thumb_url || r.image_url) ? (
                  <img src={r.thumb_url || r.image_url} alt="" style={{ width:56, height:56, objectFit:'cover' }} />
                ) : <div style={{ width:56, height:56, background:'#ffffff' }} />}
              </td>
              <td style={{ ...td, color:'#6f6a61', fontSize:'1rem' }}>{r.art_id}</td>
              <td style={td}>{r.title}</td>
              <td style={{ ...td, color:'#5c574f' }}>{r.author}</td>
              <td style={td}>
                <button
                  onClick={() => toggle(r.id, !r.in_catalog)}
                  style={{ ...toggleBtn, background: r.in_catalog ? '#2d5a2d' : '#ffffff', color: r.in_catalog ? '#2e7d32' : '#6f6a61' }}
                >
                  {r.in_catalog ? 'Да' : 'Нет'}
                </button>
              </td>
              <td style={td}>
                <Link href={`/admin/artworks/${r.id}`} style={editLink}>Редактировать</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const page: React.CSSProperties = { minHeight:'100vh', background:'#f5f4f0', color:'#1f1d1a', padding:'40px 32px', fontFamily:'var(--font-inter), system-ui, sans-serif', fontSize:'1.05rem', lineHeight:1.55 }
const h1: React.CSSProperties = { margin:0, color:'#8a6d1f', fontSize:'1.6rem' }
const th: React.CSSProperties = { padding:'8px 12px', color:'#6f6a61', fontSize:'1rem', fontWeight:400, letterSpacing:'0.1em' }
const td: React.CSSProperties = { padding:'8px 12px', verticalAlign:'middle' }
const toggleBtn: React.CSSProperties = { border:'none', padding:'4px 12px', cursor:'pointer', fontSize:'1rem', borderRadius:2 }
const editLink: React.CSSProperties = { color:'#8a6d1f', fontSize:'1.05rem', textDecoration:'none' }
const addBtn: React.CSSProperties = { background:'#c9a84c', color:'#000', padding:'8px 20px', textDecoration:'none', fontSize:'1.05rem', fontWeight:600 }
const navLink: React.CSSProperties = { color:'#6f6a61', fontSize:'1.1rem', textDecoration:'none' }
