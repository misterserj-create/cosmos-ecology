'use client'

/**
 * Переключатель языков и поля перевода для форм админки.
 *
 * Один и тот же набор нужен и работам, и событиям, отличается только список
 * полей. Русский здесь не редактируется: он живёт в исходной таблице и в
 * основной части формы, а тут только переводы.
 *
 * Отпечаток оригинала (source_hash) считается на сервере: этот файл
 * клиентский, crypto ему не положен, признак «устарел» приходит готовым.
 */

import { defaultLocale, localeShort, localeNames, locales, type Locale } from '@/i18n/config'

export type TranslationLang = Exclude<Locale, 'ru'>

export const TRANSLATION_LANGS = locales.filter(
  (l): l is TranslationLang => l !== defaultLocale
)

export type TranslationState = {
  stale: boolean
  updatedAt: string | null
  fields: Record<string, string>
}

export type FieldSpec = {
  key: string
  label: string
  /** Многострочное поле: описание, кураторский текст. */
  height?: number
}

/** Пустой набор переводов - им форма живёт, пока с сервера ничего не пришло. */
export function emptyTranslations(fields: FieldSpec[]): Record<TranslationLang, TranslationState> {
  const blank = () => {
    const values: Record<string, string> = {}
    for (const f of fields) values[f.key] = ''
    return { stale: false, updatedAt: null, fields: values }
  }
  const result = {} as Record<TranslationLang, TranslationState>
  for (const lang of TRANSLATION_LANGS) result[lang] = blank()
  return result
}

/** Вкладки языков. Кружок у подписи - у этого языка перевод устарел. */
export function LangTabs({
  active,
  onSelect,
  translations,
}: {
  active: Locale
  onSelect: (lang: Locale) => void
  translations: Record<TranslationLang, TranslationState>
}) {
  return (
    <div style={{ display: 'flex', gap: 2, marginBottom: 24, flexWrap: 'wrap' }}>
      {locales.map(lang => {
        const isActive = lang === active
        const stale = lang !== defaultLocale && translations[lang as TranslationLang]?.stale
        const filled =
          lang !== defaultLocale &&
          Object.values(translations[lang as TranslationLang]?.fields || {}).some(v => v.trim())
        return (
          <button
            key={lang}
            type="button"
            onClick={() => onSelect(lang)}
            title={localeNames[lang]}
            style={{
              padding: '8px 16px',
              border: `1px solid ${isActive ? '#c9a84c' : '#222'}`,
              background: isActive ? '#1a1608' : 'transparent',
              color: isActive ? '#c9a84c' : filled ? '#888' : '#4a4a4a',
              cursor: 'pointer',
              fontSize: '0.8rem',
              letterSpacing: '0.12em',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            {lang === defaultLocale ? 'RU · оригинал' : localeShort[lang]}
            {stale && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#e0a030' }} />}
          </button>
        )
      })}
    </div>
  )
}

/** Поля одного языка. Под каждым - русский оригинал, чтобы не листать вкладки. */
export function TranslationPanel({
  lang,
  fields,
  source,
  state,
  onChange,
}: {
  lang: TranslationLang
  fields: FieldSpec[]
  /** Русский оригинал по тем же ключам. */
  source: Record<string, string>
  state: TranslationState
  onChange: (key: string, value: string) => void
}) {
  return (
    <div style={{ display: 'grid', gap: 16, maxWidth: 960 }}>
      <div style={note}>
        Перевод на {localeNames[lang]}. Пустое поле - на сайте покажется русский оригинал.
        {state.updatedAt && (
          <span style={{ color: '#4a4a4a' }}> · сохранён {state.updatedAt.slice(0, 10)}</span>
        )}
      </div>

      {state.stale && (
        <div style={staleBox}>
          Перевод устарел: русский текст правили после того, как этот перевод сохранили.
          Сверьте с оригиналом и сохраните заново - пометка снимется.
        </div>
      )}

      {fields.map(f => (
        <div key={f.key}>
          <label style={lbl}>{f.label}</label>
          {f.height ? (
            <textarea
              value={state.fields[f.key] || ''}
              onChange={e => onChange(f.key, e.target.value)}
              style={{ ...inp, height: f.height }}
            />
          ) : (
            <input
              value={state.fields[f.key] || ''}
              onChange={e => onChange(f.key, e.target.value)}
              style={inp}
            />
          )}
          <div style={original}>{source[f.key] || <span style={{ color: '#333' }}>оригинал пуст</span>}</div>
        </div>
      ))}
    </div>
  )
}

const lbl: React.CSSProperties = { display:'block', color:'#555', fontSize:'0.75rem', letterSpacing:'0.1em', marginBottom:6, textTransform:'uppercase' }
const inp: React.CSSProperties = { width:'100%', background:'#111', border:'1px solid #222', color:'#ddd', padding:'10px 14px', fontSize:'0.95rem', outline:'none', boxSizing:'border-box', resize:'vertical' as const }
const original: React.CSSProperties = { marginTop:6, color:'#5a5a5a', fontSize:'0.8rem', lineHeight:1.5, borderLeft:'2px solid #1e1e1e', paddingLeft:10 }
const note: React.CSSProperties = { color:'#666', fontSize:'0.8rem' }
const staleBox: React.CSSProperties = { border:'1px solid #4a3d18', background:'#161206', color:'#e0a030', padding:'12px 16px', fontSize:'0.85rem', lineHeight:1.6 }
