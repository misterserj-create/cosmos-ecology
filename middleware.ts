import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'

function hash(s: string) {
  return createHash('sha256').update(s).digest('hex')
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  if (!pathname.startsWith('/admin')) return NextResponse.next()
  if (pathname === '/admin/login') return NextResponse.next()

  const token = req.cookies.get('admin_token')?.value
  const expected = hash(process.env.ADMIN_PASSWORD || 'cosmos2026')
  if (token !== expected) {
    return NextResponse.redirect(new URL('/admin/login', req.url))
  }
  return NextResponse.next()
}

export const config = { matcher: ['/admin/:path*'] }
