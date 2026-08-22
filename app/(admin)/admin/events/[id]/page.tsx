'use client'
import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { defaultLocale, type Locale } from '@/i18n/config'
import {
  LangTabs,
  TranslationPanel,
  TRANSLATION_LANGS,
  emptyTranslations,
  type FieldSpec,
  type TranslationLang,
  type TranslationState,
} from '@/components/admin/TranslationEditor'

type Event = Record<string, string | boolean | number | null | undefined>

/** Что переводится. Ключи те же, что в EVENT_TRANSLATABLE. */
const TRANSLATABLE: FieldSpec[] = [
  { key: 'title', label: 'Название' },
  { key: 'place', label: 'Место' },
  { key: 'description', label: 'Описание', height: 140 },
]

export default function EventEdit({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const isNew = id === 'new'
  const [form, setForm] = useState<Event>({
    title:'', type:'Мероприятие', event_date:'', place:'', description:'', link:'',
    image_url:'', thumb_url:'', published: false,
  })
  const [lang, setLang] = useState<Locale>(defaultLocale)
  const [translations, setTranslations] =
    useState<Record<TranslationLang, TranslationState>>(() => emptyTranslations(TRANSLATABLE))
  const [dirtyLangs, setDirtyLangs] = useState<TranslationLang[]>([])
  const [uploading, setUploading] = useState(false)
  const [saved, setSaved] = useState(false)
  const router = useRouter()

  useEffect(() => {
    if (isNew) return
    fetch(`/api/admin/events/${id}`).then(r => r.json()).then(d => {
      if (d?.event_date) d.event_date = d.event_date.slice(0,10)
      setForm(d)
    })
    fetch(`/api/admin/events/${id}/translations`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (d?.translations) setTranslations(d.translations) })
      .catch(() => {})
  }, [id, isNew])

  function set(k: string, v: string | boolean | number | null) { setForm(p => ({ ...p, [k]: v })) }

  function setTranslated(target: TranslationLang, key: string, value: string) {
    setTranslations(p => ({
      ...p,
      [target]: { ...p[target], fields: { ...p[target].fields, [key]: value } },
    }))
    setDirtyLangs(p => (p.includes(target) ? p : [...p, target]))
  }

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
    // Русская строка идёт первой: у нового события до неё нет id, а перевод
    // без id записать некуда.
    const method = isNew ? 'POST' : 'PUT'
    const url = isNew ? '/api/admin/events' : `/api/admin/events/${id}`
    const res = await fetch(url, {
      method, body: JSON.stringify(form), headers: { 'Content-Type':'application/json' },
    })
    const row = await res.json().catch(() => null)
    const savedId = String(row?.id ?? (isNew ? '' : id))

    if (savedId) {
      for (const target of dirtyLangs) {
        await fetch(`/api/admin/events/${savedId}/translations`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lang: target, fields: translations[target].fields }),
        })
      }
    }

    setDirtyLangs([])
    setSaved(true)
    setTimeout(() => router.push('/admin/events'), 800)
  }

  async function del() {
    if (!confirm('Удалить?')) return
    await fetch(`/api/admin/events/${id}`, { method:'DELETE' })
    router.push('/admin/events')
  }

  const source: Record<string, string> = Object.fromEntries(
    TRANSLATABLE.map(f => [f.key, String(form[f.key] ?? '')])
  )
  const staleCount = TRANSLATION_LANGS.filter(l => translations[l]?.stale).length

  return (
    <div style={page}>
      <div style={{ display:'flex', gap:16, alignItems:'center', marginBottom:24 }}>
        <Link href="/admin/events" style={{ color:'#6f6a61', textDecoration:'none' }}>← Назад</Link>
        <h1 style={{ margin:0, color:'#8a6d1f', fontSize:'1.4rem' }}>
          {isNew ? 'Новое событие' : form.title as string}
        </h1>
        {staleCount > 0 && <span style={staleBadge}>устарели переводы: {staleCount}</span>}
      </div>

      {!isNew && <LangTabs active={lang} onSelect={setLang} translations={translations} />}

      {lang === defaultLocale ? (
        <>
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
                  <input type="file" accept="image/*" onChange={uploadFile} style={{ color:'#5c574f' }} />
                  {uploading && <div style={{ color:'#8a6d1f', marginTop:8 }}>Загрузка...</div>}
                </div>
              </div>
            </div>
          </div>
          <p style={hint}>
            Тип события не переводится построчно: «Мероприятие» и «Новость» переведены в коде
            (lib/site.ts). Дата и ссылка от языка не зависят.
          </p>
        </>
      ) : (
        <TranslationPanel
          lang={lang as TranslationLang}
          fields={TRANSLATABLE}
          source={source}
          state={translations[lang as TranslationLang]}
          onChange={(k, v) => setTranslated(lang as TranslationLang, k, v)}
        />
      )}

      <div style={{ display:'flex', gap:12, marginTop:32 }}>
        <button onClick={save} style={saveBtn}>{saved ? 'Сохранено!' : 'Сохранить'}</button>
        {!isNew && <button onClick={del} style={delBtn}>Удалить</button>}
      </div>
    </div>
  )
}

const page: React.CSSProperties = { minHeight:'100vh', background:'#f5f4f0', color:'#1f1d1a', padding:'40px 32px', fontFamily:'var(--font-inter), system-ui, sans-serif', fontSize:'1.05rem', lineHeight:1.55 }
const lbl: React.CSSProperties = { display:'block', color:'#6f6a61', fontSize:'0.95rem', letterSpacing:'0.1em', marginBottom:6, textTransform:'uppercase' }
const inp: React.CSSProperties = { width:'100%', background:'#ffffff', border:'1px solid #d9d5cc', color:'#1f1d1a', padding:'10px 14px', fontSize:'1.15rem', outline:'none', boxSizing:'border-box', resize:'vertical' as const }
const saveBtn: React.CSSProperties = { background:'#c9a84c', color:'#000', border:'none', padding:'12px 32px', fontSize:'1.1rem', cursor:'pointer', fontWeight:600 }
const delBtn: React.CSSProperties = { background:'transparent', color:'#b3261e', border:'1px solid #b3261e', padding:'12px 24px', fontSize:'1.1rem', cursor:'pointer' }
const staleBadge: React.CSSProperties = { color:'#9a6b00', border:'1px solid #c9a84c', padding:'4px 10px', fontSize:'0.95rem' }
const hint: React.CSSProperties = { maxWidth:960, marginTop:20, color:'#8a857b', fontSize:'1rem', lineHeight:1.6 }
