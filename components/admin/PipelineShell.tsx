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
                <Link key={s.href} href={s.href} style={{ ...navLink, color: active ? '#c9a84c' : '#6f6a61' }}>
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
      <div style={{ color: '#8a857b', fontSize: '0.95rem', marginBottom: 24, letterSpacing: '0.05em' }}>контент-тракт</div>
      {children}
    </div>
  )
}

export const page: React.CSSProperties = { minHeight: '100vh', background: '#f5f4f0', color: '#1f1d1a', padding: '40px 32px', fontFamily: 'sans-serif' }
export const h1: React.CSSProperties = { margin: 0, color: '#8a6d1f', fontSize: '1.6rem' }
export const th: React.CSSProperties = { padding: '8px 12px', color: '#6f6a61', fontSize: '0.95rem', fontWeight: 400, letterSpacing: '0.1em', textAlign: 'left' }
export const td: React.CSSProperties = { padding: '8px 12px', verticalAlign: 'top', fontSize: '1.1rem' }
export const navLink: React.CSSProperties = { color: '#6f6a61', fontSize: '1.1rem', textDecoration: 'none' }
export const btn: React.CSSProperties = { border: '1px solid #c4bfb4', background: '#ffffff', color: '#2f2c27', padding: '6px 14px', cursor: 'pointer', fontSize: '1rem', borderRadius: 2 }
export const btnGold: React.CSSProperties = { ...btn, background: '#c9a84c', color: '#000', border: '1px solid #8a6d1f', fontWeight: 600 }
export const btnRed: React.CSSProperties = { ...btn, color: '#b3261e', borderColor: '#533' }
export const card: React.CSSProperties = { background: '#ffffff', border: '1px solid #d9d5cc', padding: '16px 20px', borderRadius: 2 }
export const muted: React.CSSProperties = { color: '#6f6a61', fontSize: '1rem' }
export const pre: React.CSSProperties = { whiteSpace: 'pre-wrap', fontFamily: 'inherit', lineHeight: 1.55, fontSize: '1.15rem', margin: 0 }
export const input: React.CSSProperties = { background: '#ffffff', border: '1px solid #c4bfb4', color: '#1f1d1a', padding: '8px 12px', fontSize: '1.1rem', outline: 'none', width: '100%', boxSizing: 'border-box' }

export const VERDICT_COLOR: Record<string, string> = { new: '#5c574f', accepted: '#2e7d32', rejected: '#8c2a23', duplicate: '#776' }
export const STATUS_COLOR: Record<string, string> = { draft: '#5c574f', review: '#c9a84c', approved: '#2e7d32', published: '#1f5fa8', rejected: '#8c2a23' }
export const STATUS_LABEL: Record<string, string> = { draft: 'черновик', review: 'на проверке', approved: 'одобрен', published: 'опубликован', rejected: 'отклонён' }
export const STAGE_LABEL: Record<string, string> = { collect: 'сбор', judge: 'отбор', write: 'тексты', translate: 'переводы', publish: 'публикация' }

export function Badge({ text, color }: { text: string; color: string }) {
  return <span style={{ color, border: `1px solid ${color}55`, padding: '2px 8px', fontSize: '0.95rem', borderRadius: 2, whiteSpace: 'nowrap' }}>{text}</span>
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
