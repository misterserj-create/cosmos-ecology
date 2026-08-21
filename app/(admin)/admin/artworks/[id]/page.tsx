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

type Artwork = Record<string, string | boolean | number | null | undefined>

/** Что переводится. Порядок и ключи те же, что в ARTWORK_TRANSLATABLE. */
const TRANSLATABLE: FieldSpec[] = [
  { key: 'title', label: 'Название' },
  { key: 'materials', label: 'Материалы', height: 80 },
  { key: 'desc_short', label: 'Описание (короткое)', height: 80 },
  { key: 'curator_text', label: 'Кураторский текст', height: 160 },
]

export default function ArtworkEdit({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const isNew = id === 'new'
  const [form, setForm] = useState<Artwork>({
    art_id:'', title:'', author:'', technique:'', materials:'', size:'',
    year:'', status:'', desc_short:'', curator_text:'', category:'', in_catalog: false,
    image_url:'', thumb_url:'',
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
    fetch(`/api/admin/artworks/${id}`).then(r => r.json()).then(setForm)
    fetch(`/api/admin/artworks/${id}/translations`)
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
    // Сначала русская строка: у новой работы до этого нет id, а перевод без
    // id записать некуда. Заодно так отпечаток оригинала считается уже по
    // свежему русскому тексту, и правка русского с переводом за один заход
    // не помечает перевод устаревшим сразу после сохранения.
    const method = isNew ? 'POST' : 'PUT'
    const url = isNew ? '/api/admin/artworks' : `/api/admin/artworks/${id}`
    const res = await fetch(url, {
      method, body: JSON.stringify(form), headers: { 'Content-Type':'application/json' },
    })
    const row = await res.json().catch(() => null)
    const savedId = String(row?.id ?? (isNew ? '' : id))

    if (savedId) {
      for (const target of dirtyLangs) {
        await fetch(`/api/admin/artworks/${savedId}/translations`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lang: target, fields: translations[target].fields }),
        })
      }
    }

    setDirtyLangs([])
    setSaved(true)
    setTimeout(() => router.push('/admin/artworks'), 800)
  }

  async function del() {
    if (!confirm('Удалить?')) return
    await fetch(`/api/admin/artworks/${id}`, { method:'DELETE' })
    router.push('/admin/artworks')
  }

  const source: Record<string, string> = Object.fromEntries(
    TRANSLATABLE.map(f => [f.key, String(form[f.key] ?? '')])
  )
  const staleCount = TRANSLATION_LANGS.filter(l => translations[l]?.stale).length

  return (
    <div style={page}>
      <div style={{ display:'flex', gap:16, alignItems:'center', marginBottom:24 }}>
        <Link href="/admin/artworks" style={{ color:'#555', textDecoration:'none' }}>← Назад</Link>
        <h1 style={{ margin:0, color:'#c9a84c', fontSize:'1.2rem' }}>
          {isNew ? 'Новая работа' : form.title as string}
        </h1>
        {staleCount > 0 && (
          <span style={staleBadge}>устарели переводы: {staleCount}</span>
        )}
      </div>

      {/* Новая работа: пока нет id, писать перевод некуда - вкладки появятся
          после первого сохранения. */}
      {!isNew && (
        <LangTabs active={lang} onSelect={setLang} translations={translations} />
      )}

      {lang === defaultLocale ? (
        <>
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
          <p style={hint}>
            Техника, статус и категория не переводятся построчно: их переводы лежат в коде
            (lib/site.ts). Новое значение - добавьте туда, иначе на других языках оно
            останется по-русски.
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

const page: React.CSSProperties = { minHeight:'100vh', background:'#080808', color:'#ddd', padding:'40px 32px', fontFamily:'sans-serif' }
const lbl: React.CSSProperties = { display:'block', color:'#555', fontSize:'0.75rem', letterSpacing:'0.1em', marginBottom:6, textTransform:'uppercase' }
const inp: React.CSSProperties = { width:'100%', background:'#111', border:'1px solid #222', color:'#ddd', padding:'10px 14px', fontSize:'0.95rem', outline:'none', boxSizing:'border-box', resize:'vertical' as const }
const saveBtn: React.CSSProperties = { background:'#c9a84c', color:'#000', border:'none', padding:'12px 32px', fontSize:'0.9rem', cursor:'pointer', fontWeight:600 }
const delBtn: React.CSSProperties = { background:'transparent', color:'#e55', border:'1px solid #e55', padding:'12px 24px', fontSize:'0.9rem', cursor:'pointer' }
const staleBadge: React.CSSProperties = { color:'#e0a030', border:'1px solid #4a3d18', padding:'4px 10px', fontSize:'0.75rem' }
const hint: React.CSSProperties = { maxWidth:960, marginTop:20, color:'#4a4a4a', fontSize:'0.8rem', lineHeight:1.6 }
