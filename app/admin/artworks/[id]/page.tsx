'use client'
import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type Artwork = Record<string, string | boolean | number | null | undefined>

export default function ArtworkEdit({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const isNew = id === 'new'
  const [form, setForm] = useState<Artwork>({
    art_id:'', title:'', author:'', technique:'', materials:'', size:'',
    year:'', status:'', desc_short:'', curator_text:'', category:'', in_catalog: false,
    image_url:'', thumb_url:'',
  })
  const [uploading, setUploading] = useState(false)
  const [saved, setSaved] = useState(false)
  const router = useRouter()

  useEffect(() => {
    if (!isNew) fetch(`/api/admin/artworks/${id}`).then(r => r.json()).then(setForm)
  }, [id, isNew])

  function set(k: string, v: string | boolean | number | null) { setForm(p => ({ ...p, [k]: v })) }

  async function uploadFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const fd = new FormData(); fd.append('file', file)
    const r = await fetch('/api/admin/upload', { method:'POST', body: fd })
    const { imageUrl, thumbUrl } = await r.json()
    setForm(p => ({ ...p, image_url: imageUrl, thumb_url: thumbUrl }))
    setUploading(false)
  }

  async function save() {
    const method = isNew ? 'POST' : 'PUT'
    const url = isNew ? '/api/admin/artworks' : `/api/admin/artworks/${id}`
    await fetch(url, { method, body: JSON.stringify(form), headers: { 'Content-Type':'application/json' } })
    setSaved(true)
    setTimeout(() => router.push('/admin/artworks'), 800)
  }

  async function del() {
    if (!confirm('Удалить?')) return
    await fetch(`/api/admin/artworks/${id}`, { method:'DELETE' })
    router.push('/admin/artworks')
  }

  return (
    <div style={page}>
      <div style={{ display:'flex', gap:16, alignItems:'center', marginBottom:32 }}>
        <Link href="/admin/artworks" style={{ color:'#555', textDecoration:'none' }}>← Назад</Link>
        <h1 style={{ margin:0, color:'#c9a84c', fontSize:'1.2rem' }}>
          {isNew ? 'Новая работа' : form.title as string}
        </h1>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, maxWidth:960 }}>
        {[
          ['art_id','ID (CK-001)'], ['title','Название'], ['author','Автор'],
          ['technique','Техника'], ['materials','Материалы'], ['size','Габариты (см)'],
          ['year','Год'], ['status','Статус'], ['category','Категория'],
        ].map(([k, label]) => (
          <div key={k}>
            <label style={lbl}>{label}</label>
            <input value={form[k] as string || ''} onChange={e => set(k, e.target.value)} style={inp} />
          </div>
        ))}

        <div style={{ gridColumn:'1/-1' }}>
          <label style={lbl}>Описание (короткое)</label>
          <textarea value={form.desc_short as string || ''} onChange={e => set('desc_short', e.target.value)} style={{ ...inp, height:80 }} />
        </div>
        <div style={{ gridColumn:'1/-1' }}>
          <label style={lbl}>Кураторский текст</label>
          <textarea value={form.curator_text as string || ''} onChange={e => set('curator_text', e.target.value)} style={{ ...inp, height:120 }} />
        </div>

        <div style={{ gridColumn:'1/-1', display:'flex', alignItems:'center', gap:12 }}>
          <label style={lbl}>В галерею</label>
          <input type="checkbox" checked={!!form.in_catalog} onChange={e => set('in_catalog', e.target.checked)} style={{ width:18, height:18 }} />
        </div>

        <div style={{ gridColumn:'1/-1' }}>
          <label style={lbl}>Изображение</label>
          <div style={{ display:'flex', gap:16, alignItems:'flex-start' }}>
            {form.thumb_url && <img src={form.thumb_url as string} alt="" style={{ width:120, height:120, objectFit:'cover' }} />}
            <div>
              <input type="file" accept="image/*" onChange={uploadFile} style={{ color:'#888' }} />
              {uploading && <div style={{ color:'#c9a84c', marginTop:8 }}>Загрузка...</div>}
            </div>
          </div>
        </div>
      </div>

      <div style={{ display:'flex', gap:12, marginTop:32 }}>
        <button onClick={save} style={saveBtn}>{saved ? 'Сохранено!' : 'Сохранить'}</button>
        {!isNew && <button onClick={del} style={delBtn}>Удалить</button>}
      </div>
    </div>
  )
}

const page: React.CSSProperties = { minHeight:'100vh', background:'#080808', color:'#ddd', padding:'40px 32px', fontFamily:'sans-serif' }
const lbl: React.CSSProperties = { display:'block', color:'#555', fontSize:'0.75rem', letterSpacing:'0.1em', marginBottom:6, textTransform:'uppercase' }
const inp: React.CSSProperties = { width:'100%', background:'#111', border:'1px solid #222', color:'#ddd', padding:'10px 14px', fontSize:'0.95rem', outline:'none', boxSizing:'border-box', resize:'vertical' as const }
const saveBtn: React.CSSProperties = { background:'#c9a84c', color:'#000', border:'none', padding:'12px 32px', fontSize:'0.9rem', cursor:'pointer', fontWeight:600 }
const delBtn: React.CSSProperties = { background:'transparent', color:'#e55', border:'1px solid #e55', padding:'12px 24px', fontSize:'0.9rem', cursor:'pointer' }
