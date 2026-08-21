import { NextRequest, NextResponse } from 'next/server'
import { dbJournalPosts, dbJournalUpsert } from '@/lib/db'

export async function GET() {
  const rows = await dbJournalPosts()
  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  const data = await req.json()
  try {
    const row = await dbJournalUpsert(data)
    return NextResponse.json(row)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 400 })
  }
}
