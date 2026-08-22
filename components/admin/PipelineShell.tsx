'use client'

/**
 * Каркас страниц контент-тракта: шапка с разделами и общие стили в духе
 * остальной админки (тёмный фон, золотые заголовки, инлайн-стили без
 * отдельной таблицы стилей).
 */

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const SECTIONS = [
  { href: '/admin/pipeline', label: 'Обзор' },
  { href: '/admin/pipeline/findings', label: 'Находки' },
  { href: '/admin/pipeline/drafts', label: 'Черновики' },
  { href: '/admin/pipeline/settings', label: 'Настройки' },
]

export function PipelineShell({ title, children, right }: { title: string; children: React.ReactNode; right?: React.ReactNode }) {
  const path = usePathname()
  return (
    <div style={page}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
          <h1 style={h1}>{title}</h1>
          <nav style={{ display: 'flex', gap: 14 }}>
            {SECTIONS.map(s => {
              const active = s.href === '/admin/pipeline' ? path === s.href : path.startsWith(s.href)
              return (
                <Link key={s.href} href={s.href} style={{ ...navLink, color: active ? '#c9a84c' : '#666' }}>
                  {s.label}
                </Link>
              )
            })}
          </nav>
        </div>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          {right}
          <Link href="/admin/artworks" style={navLink}>→ Работы</Link>
        </div>
      </div>
      <div style={{ color: '#444', fontSize: '0.75rem', marginBottom: 24, letterSpacing: '0.05em' }}>контент-тракт</div>
      {children}
    </div>
  )
}

export const page: React.CSSProperties = { minHeight: '100vh', background: '#080808', color: '#ddd', padding: '40px 32px', fontFamily: 'sans-serif' }
export const h1: React.CSSProperties = { margin: 0, color: '#c9a84c', fontSize: '1.4rem' }
export const th: React.CSSProperties = { padding: '8px 12px', color: '#555', fontSize: '0.75rem', fontWeight: 400, letterSpacing: '0.1em', textAlign: 'left' }
export const td: React.CSSProperties = { padding: '8px 12px', verticalAlign: 'top', fontSize: '0.9rem' }
export const navLink: React.CSSProperties = { color: '#666', fontSize: '0.9rem', textDecoration: 'none' }
export const btn: React.CSSProperties = { border: '1px solid #333', background: '#111', color: '#ccc', padding: '6px 14px', cursor: 'pointer', fontSize: '0.8rem', borderRadius: 2 }
export const btnGold: React.CSSProperties = { ...btn, background: '#c9a84c', color: '#000', border: '1px solid #c9a84c', fontWeight: 600 }
export const btnRed: React.CSSProperties = { ...btn, color: '#e66', borderColor: '#533' }
export const card: React.CSSProperties = { background: '#0f0f0f', border: '1px solid #1e1e1e', padding: '16px 20px', borderRadius: 2 }
export const muted: React.CSSProperties = { color: '#666', fontSize: '0.8rem' }
export const pre: React.CSSProperties = { whiteSpace: 'pre-wrap', fontFamily: 'inherit', lineHeight: 1.55, fontSize: '0.95rem', margin: 0 }
export const input: React.CSSProperties = { background: '#111', border: '1px solid #333', color: '#fff', padding: '8px 12px', fontSize: '0.9rem', outline: 'none', width: '100%', boxSizing: 'border-box' }

export const VERDICT_COLOR: Record<string, string> = { new: '#888', accepted: '#4caf50', rejected: '#a55', duplicate: '#776' }
export const STATUS_COLOR: Record<string, string> = { draft: '#888', review: '#c9a84c', approved: '#4caf50', published: '#5b9bd5', rejected: '#a55' }
export const STATUS_LABEL: Record<string, string> = { draft: 'черновик', review: 'на проверке', approved: 'одобрен', published: 'опубликован', rejected: 'отклонён' }
export const STAGE_LABEL: Record<string, string> = { collect: 'сбор', judge: 'отбор', write: 'тексты', translate: 'переводы', publish: 'публикация' }

export function Badge({ text, color }: { text: string; color: string }) {
  return <span style={{ color, border: `1px solid ${color}55`, padding: '2px 8px', fontSize: '0.75rem', borderRadius: 2, whiteSpace: 'nowrap' }}>{text}</span>
}

export function fmtDate(v: unknown) {
  if (!v) return ''
  const d = new Date(String(v))
  if (Number.isNaN(d.getTime())) return String(v)
  return d.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export function usd(v: unknown) {
  const n = Number(v || 0)
  return n < 0.01 && n > 0 ? `$${n.toFixed(4)}` : `$${n.toFixed(2)}`
}
