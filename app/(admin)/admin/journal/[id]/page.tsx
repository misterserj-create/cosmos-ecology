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

type Post = {
  slug: string
  published: boolean
  published_at: string
  title: string
  excerpt: string
  body: string
  cover_url: string
  gallery_urls: string[]
  video_urls: string[]
  source_links: string
  tags: string
}

/**
 * Что переводится. Порядок title/excerpt/body тот же, что в
 * JOURNAL_TRANSLATABLE. Адрес переводится тоже, но в отпечаток не входит.
 */
const TRANSLATABLE: FieldSpec[] = [
  { key: 'title', label: 'Заголовок' },
  { key: 'excerpt', label: 'Анонс (первый абзац)', height: 80 },
  { key: 'body', label: 'Текст (абзацы через пустую строку)', height: 320 },
  { key: 'slug', label: 'Адрес на этом языке (например night-talk-in-the-studio)' },
]

const TRANSLIT: Record<string, string> = {
  а:'a', б:'b', в:'v', г:'g', д:'d', е:'e', ё:'e', ж:'zh', з:'z', и:'i', й:'y', к:'k', л:'l',
  м:'m', н:'n', о:'o', п:'p', р:'r', с:'s', т:'t', у:'u', ф:'f', х:'h', ц:'ts', ч:'ch',
  ш:'sh', щ:'sch', ъ:'', ы:'y', ь:'', э:'e', ю:'yu', я:'ya',
}

/** Транслит заголовка в адрес, до 60 знаков - та же схема, что в скрипте загрузки. */
function slugify(title: string): string {
  let s = title.toLowerCase().split('').map(ch => TRANSLIT[ch] ?? ch).join('')
  s = s.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  if (s.length > 60) s = s.slice(0, 60).replace(/-[^-]*$/, '')
  return s
}

const EMPTY: Post = {
  slug: '', published: false, published_at: new Date().toISOString().slice(0, 10),
  title: '', excerpt: '', body: '', cover_url: '', gallery_urls: [], video_urls: [],
  source_links: '', tags: '',
}

export default function JournalEdit({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const isNew = id === 'new'
  const [form, setForm] = useState<Post>(EMPTY)
  const [lang, setLang] = useState<Locale>(defaultLocale)
  const [translations, setTranslations] =
    useState<Record<TranslationLang, TranslationState>>(() => emptyTranslations(TRANSLATABLE))
  const [dirtyLangs, setDirtyLangs] = useState<TranslationLang[]>([])
  const [uploading, setUploading] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  useEffect(() => {
    if (isNew) return
    fetch(`/api/admin/journal/${id}`).then(r => r.json()).then(row => {
      setForm({
        slug: row.slug || '',
        published: Boolean(row.published),
        published_at: String(row.published_at || '').slice(0, 10),
        title: row.title || '',
        excerpt: row.excerpt || '',
        body: row.body || '',
        cover_url: row.cover_url || '',
        gallery_urls: row.gallery_urls || [],
        video_urls: row.video_urls || [],
        source_links: (row.source_links || []).join('\n'),
        tags: (row.tags || []).join(', '),
      })
    })
    fetch(`/api/admin/journal/${id}/translations`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (d?.translations) setTranslations(d.translations) })
      .catch(() => {})
  }, [id, isNew])

  function set<K extends keyof Post>(k: K, v: Post[K]) { setForm(p => ({ ...p, [k]: v })) }

  function setTranslated(target: TranslationLang, key: string, value: string) {
    setTranslations(p => ({
      ...p,
      [target]: { ...p[target], fields: { ...p[target].fields, [key]: value } },
    }))
    setDirtyLangs(p => (p.includes(target) ? p : [...p, target]))
  }

  async function upload(file: File): Promise<{ imageUrl?: string; videoUrl?: string }> {
    const fd = new FormData(); fd.append('file', file)
    const r = await fetch('/api/admin/upload', { method: 'POST', body: fd })
    return r.json()
  }

  async function uploadCover(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading('cover')
    const { imageUrl } = await upload(file)
    if (imageUrl) set('cover_url', imageUrl)
    setUploading(null)
  }

  async function uploadGallery(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    setUploading('gallery')
    const urls: string[] = []
    for (const f of files) {
      const { imageUrl } = await upload(f)
      if (imageUrl) urls.push(imageUrl)
    }
    setForm(p => ({ ...p, gallery_urls: [...p.gallery_urls, ...urls] }))
    setUploading(null)
  }

  async function uploadVideoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading('video')
    const { videoUrl } = await upload(file)
    if (videoUrl) setForm(p => ({ ...p, video_urls: [...p.video_urls, videoUrl] }))
    setUploading(null)
  }

  async function save() {
    setError('')
    const payload = {
      ...form,
      slug: form.slug || slugify(form.title),
      published_at: form.published_at || null,
      source_links: form.source_links.split('\n').map(s => s.trim()).filter(Boolean),
      tags: form.tags.split(',').map(s => s.trim()).filter(Boolean),
    }
    // Сначала русская строка, потом переводы - как у работ: у новой
    // публикации до сохранения нет id, и отпечаток оригинала считается
    // уже по свежему тексту.
    const method = isNew ? 'POST' : 'PUT'
    const url = isNew ? '/api/admin/journal' : `/api/admin/journal/${id}`
    const res = await fetch(url, {
      method, body: JSON.stringify(payload), headers: { 'Content-Type': 'application/json' },
    })
    const row = await res.json().catch(() => null)
    if (!res.ok) {
      setError(row?.error || `Ошибка ${res.status}`)
      return
    }
    const savedId = String(row?.id ?? (isNew ? '' : id))

    if (savedId) {
      for (const target of dirtyLangs) {
        const r = await fetch(`/api/admin/journal/${savedId}/translations`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lang: target, fields: translations[target].fields }),
        })
        if (!r.ok) {
          const d = await r.json().catch(() => null)
          setError(`Перевод ${target}: ${d?.error || r.status}`)
          return
        }
      }
    }

    setDirtyLangs([])
    setSaved(true)
    setTimeout(() => router.push('/admin/journal'), 800)
  }

  async function del() {
    if (!confirm('Удалить публикацию?')) return
    await fetch(`/api/admin/journal/${id}`, { method: 'DELETE' })
    router.push('/admin/journal')
  }

  const source: Record<string, string> = {
    title: form.title, excerpt: form.excerpt, body: form.body, slug: form.slug,
  }
  const staleCount = TRANSLATION_LANGS.filter(l => translations[l]?.stale).length

  return (
    <div style={page}>
      <div style={{ display:'flex', gap:16, alignItems:'center', marginBottom:24 }}>
        <Link href="/admin/journal" style={{ color:'#555', textDecoration:'none' }}>← Назад</Link>
        <h1 style={{ margin:0, color:'#c9a84c', fontSize:'1.2rem' }}>
          {isNew ? 'Новая публикация' : form.title}
        </h1>
        {staleCount > 0 && (
          <span style={staleBadge}>устарели переводы: {staleCount}</span>
        )}
      </div>

      {!isNew && (
        <LangTabs active={lang} onSelect={setLang} translations={translations} />
      )}

      {lang === defaultLocale ? (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, maxWidth:960 }}>
          <div style={{ gridColumn:'1/-1' }}>
            <label style={lbl}>Заголовок</label>
            <input value={form.title} onChange={e => set('title', e.target.value)} style={inp} />
          </div>

          <div>
            <label style={lbl}>Адрес (slug)</label>
            <div style={{ display:'flex', gap:8 }}>
              <input value={form.slug} onChange={e => set('slug', e.target.value)} placeholder={slugify(form.title) || 'заполнится из заголовка'} style={inp} />
              <button type="button" onClick={() => set('slug', slugify(form.title))} style={smallBtn} title="Собрать из заголовка">⟳</button>
            </div>
          </div>
          <div>
            <label style={lbl}>Дата публикации</label>
            <input type="date" value={form.published_at} onChange={e => set('published_at', e.target.value)} style={inp} />
          </div>

          <div style={{ gridColumn:'1/-1' }}>
            <label style={lbl}>Анонс (первый абзац)</label>
            <textarea value={form.excerpt} onChange={e => set('excerpt', e.target.value)} style={{ ...inp, height:80 }} />
          </div>
          <div style={{ gridColumn:'1/-1' }}>
            <label style={lbl}>Текст (абзацы через пустую строку)</label>
            <textarea value={form.body} onChange={e => set('body', e.target.value)} style={{ ...inp, height:320 }} />
          </div>

          <div style={{ gridColumn:'1/-1', display:'flex', alignItems:'center', gap:12 }}>
            <label style={lbl}>Опубликовано</label>
            <input type="checkbox" checked={form.published} onChange={e => set('published', e.target.checked)} style={{ width:18, height:18 }} />
          </div>

          <div style={{ gridColumn:'1/-1' }}>
            <label style={lbl}>Обложка</label>
            <div style={{ display:'flex', gap:16, alignItems:'flex-start' }}>
              {form.cover_url && <img src={form.cover_url} alt="" style={{ width:180, height:120, objectFit:'cover' }} />}
              <div>
                <input type="file" accept="image/*" onChange={uploadCover} style={{ color:'#888' }} />
                {uploading === 'cover' && <div style={{ color:'#c9a84c', marginTop:8 }}>Загрузка...</div>}
                {form.cover_url && (
                  <button type="button" onClick={() => set('cover_url', '')} style={{ ...linkBtn, marginTop:8 }}>убрать обложку</button>
                )}
              </div>
            </div>
          </div>

          <div style={{ gridColumn:'1/-1' }}>
            <label style={lbl}>Галерея</label>
            <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:8 }}>
              {form.gallery_urls.map((u, i) => (
                <div key={u + i} style={{ position:'relative' }}>
                  <img src={u} alt="" style={{ width:120, height:90, objectFit:'cover', display:'block' }} />
                  <div style={{ display:'flex', gap:6, marginTop:4 }}>
                    <button type="button" onClick={() => set('cover_url', u)} style={linkBtn}>обложка</button>
                    <button type="button" onClick={() => set('gallery_urls', form.gallery_urls.filter((_, j) => j !== i))} style={{ ...linkBtn, color:'#e55' }}>убрать</button>
                  </div>
                </div>
              ))}
            </div>
            <input type="file" accept="image/*" multiple onChange={uploadGallery} style={{ color:'#888' }} />
            {uploading === 'gallery' && <div style={{ color:'#c9a84c', marginTop:8 }}>Загрузка...</div>}
          </div>

          <div style={{ gridColumn:'1/-1' }}>
            <label style={lbl}>Видео</label>
            {form.video_urls.map((u, i) => (
              <div key={u + i} style={{ display:'flex', gap:12, alignItems:'center', marginBottom:6, fontSize:'0.85rem', color:'#888' }}>
                <span style={{ wordBreak:'break-all' }}>{u}</span>
                <button type="button" onClick={() => set('video_urls', form.video_urls.filter((_, j) => j !== i))} style={{ ...linkBtn, color:'#e55' }}>убрать</button>
              </div>
            ))}
            <input type="file" accept="video/*" onChange={uploadVideoFile} style={{ color:'#888' }} />
            {uploading === 'video' && <div style={{ color:'#c9a84c', marginTop:8 }}>Загрузка...</div>}
          </div>

          <div>
            <label style={lbl}>Ссылки на источники (по одной в строке)</label>
            <textarea value={form.source_links} onChange={e => set('source_links', e.target.value)} style={{ ...inp, height:100 }} />
          </div>
          <div>
            <label style={lbl}>Метки (через запятую)</label>
            <input value={form.tags} onChange={e => set('tags', e.target.value)} style={inp} />
          </div>
        </div>
      ) : (
        <TranslationPanel
          lang={lang as TranslationLang}
          fields={TRANSLATABLE}
          source={source}
          state={translations[lang as TranslationLang]}
          onChange={(k, v) => setTranslated(lang as TranslationLang, k, v)}
        />
      )}

      {error && <div style={errorBox}>{error}</div>}

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
const smallBtn: React.CSSProperties = { background:'#111', color:'#c9a84c', border:'1px solid #222', padding:'0 14px', cursor:'pointer' }
const linkBtn: React.CSSProperties = { background:'none', border:'none', color:'#c9a84c', cursor:'pointer', fontSize:'0.75rem', padding:0 }
const staleBadge: React.CSSProperties = { color:'#e0a030', border:'1px solid #4a3d18', padding:'4px 10px', fontSize:'0.75rem' }
const errorBox: React.CSSProperties = { marginTop:20, maxWidth:960, border:'1px solid #5a2d2d', background:'#160606', color:'#e55', padding:'12px 16px', fontSize:'0.85rem' }
