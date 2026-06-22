'use client'
import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type Event = Record<string, string | boolean | number | null | undefined>

export default function EventEdit({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const isNew = id === 'new'
  const [form, setForm] = useState<Event>({
    title:'', type:'Мероприятие', event_date:'', place:'', description:'', link:'',
    image_url:'', thumb_url:'', published: false,
  })
  const [uploading, setUploading] = useState(false)
  const [saved, setSaved] = useState(false)
  const router = useRouter()

  useEffect(() => {
    if (!isNew) fetch(`/api/admin/events/${id}`).then(r => r.json()).then(d => {
      if (d?.event_date) d.event_date = d.event_date.slice(0,10)
      setForm(d)
    })
  }, [id, isNew])

  function set(k: string, v: string | boolean | number | null) { setForm(p => ({ ...p, [k]: v })) }

  async function uploadFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    setUploading(true)
    const fd = new FormData(); fd.append('file', file)
    const r = await fetch('/api/admin/upload', { method:'POST', body: fd })
    const { imageUrl, thumbUrl } = await r.json()
    setForm(p => ({ ...p, image_url: imageUrl, thumb_url: thumbUrl }))
    setUploading(false)
  }

  async function save() {
    const method = isNew ? 'POST' : 'PUT'
    const url = isNew ? '/api/admin/events' : `/api/admin/events/${id}`
    await fetch(url, { method, body: JSON.stringify(form), headers: { 'Content-Type':'application/json' } })
    setSaved(true)
    setTimeout(() => router.push('/admin/events'), 800)
  }

  async function del() {
    if (!confirm('Удалить?')) return
    await fetch(`/api/admin/events/${id}`, { method:'DELETE' })
    router.push('/admin/events')
  }

  return (
    <div style={page}>
      <div style={{ display:'flex', gap:16, alignItems:'center', marginBottom:32 }}>
        <Link href="/admin/events" style={{ color:'#555', textDecoration:'none' }}>← Назад</Link>
        <h1 style={{ margin:0, color:'#c9a84c', fontSize:'1.2rem' }}>
          {isNew ? 'Новое событие' : form.title as string}
        </h1>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, maxWidth:960 }}>
        <div style={{ gridColumn:'1/-1' }}>
          <label style={lbl}>Название</label>
          <input value={form.title as string || ''} onChange={e => set('title', e.target.value)} style={inp} />
        </div>

        <div>
          <label style={lbl}>Тип</label>
          <select value={form.type as string || ''} onChange={e => set('type', e.target.value)} style={inp}>
            <option>Мероприятие</option>
            <option>Новость</option>
          </select>
        </div>

        <div>
          <label style={lbl}>Дата</label>
          <input type="date" value={form.event_date as string || ''} onChange={e => set('event_date', e.target.value)} style={inp} />
        </div>

        <div>
          <label style={lbl}>Место</label>
          <input value={form.place as string || ''} onChange={e => set('place', e.target.value)} style={inp} />
        </div>

        <div>
          <label style={lbl}>Ссылка</label>
          <input value={form.link as string || ''} onChange={e => set('link', e.target.value)} style={inp} />
        </div>

        <div style={{ gridColumn:'1/-1' }}>
          <label style={lbl}>Описание</label>
          <textarea value={form.description as string || ''} onChange={e => set('description', e.target.value)} style={{ ...inp, height:100 }} />
        </div>

        <div style={{ gridColumn:'1/-1', display:'flex', alignItems:'center', gap:12 }}>
          <label style={lbl}>Опубликовать</label>
          <input type="checkbox" checked={!!form.published} onChange={e => set('published', e.target.checked)} style={{ width:18, height:18 }} />
        </div>

        <div style={{ gridColumn:'1/-1' }}>
          <label style={lbl}>Фото</label>
          <div style={{ display:'flex', gap:16, alignItems:'flex-start' }}>
            {form.thumb_url && <img src={form.thumb_url as string} alt="" style={{ width:120, height:80, objectFit:'cover' }} />}
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
