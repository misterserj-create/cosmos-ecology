'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [pw, setPw] = useState('')
  const [err, setErr] = useState('')
  const router = useRouter()

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const r = await fetch('/api/admin/login', {
      method: 'POST',
      body: JSON.stringify({ password: pw }),
      headers: { 'Content-Type': 'application/json' },
    })
    if (r.ok) router.push('/admin/artworks')
    else setErr('Неверный пароль')
  }

  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#f5f4f0' }}>
      <form onSubmit={submit} style={{ display:'flex', flexDirection:'column', gap:16, width:320 }}>
        <h1 style={{ color:'#8a6d1f', fontFamily:'serif', margin:0, fontSize:'1.7rem' }}>Экология Космоса · Админ</h1>
        <input
          type="password" value={pw} onChange={e => setPw(e.target.value)}
          placeholder="Пароль" autoFocus
          style={inp}
        />
        {err && <div style={{ color:'#b3261e', fontSize:'1.05rem' }}>{err}</div>}
        <button type="submit" style={btn}>Войти</button>
      </form>
    </div>
  )
}

const inp: React.CSSProperties = {
  background:'#ffffff', border:'1px solid #c4bfb4', color:'#1f1d1a',
  padding:'12px 16px', fontSize:'1.15rem', outline:'none',
}
const btn: React.CSSProperties = {
  background:'#c9a84c', color:'#000', border:'none',
  padding:'12px', fontSize:'1.1rem', cursor:'pointer', fontWeight:600,
}
