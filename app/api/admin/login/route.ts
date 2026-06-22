import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'

export async function POST(req: NextRequest) {
  const { password } = await req.json()
  const expected = process.env.ADMIN_PASSWORD || 'cosmos2026'
  if (password !== expected) {
    return NextResponse.json({ error: 'Неверный пароль' }, { status: 401 })
  }
  const token = createHash('sha256').update(expected).digest('hex')
  const res = NextResponse.json({ ok: true })
  res.cookies.set('admin_token', token, { httpOnly: true, path: '/', maxAge: 60 * 60 * 24 * 30 })
  return res
}
