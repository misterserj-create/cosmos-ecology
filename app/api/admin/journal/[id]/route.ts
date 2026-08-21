import { NextRequest, NextResponse } from 'next/server'
import { dbJournalById, dbJournalDelete, dbJournalToggle, dbJournalUpsert } from '@/lib/db'

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const row = await dbJournalById(id)
  if (!row) return NextResponse.json({ error: 'not found' }, { status: 404 })
  return NextResponse.json(row)
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const data = await req.json()
  try {
    const row = await dbJournalUpsert(data, id)
    return NextResponse.json(row)
  } catch (e) {
    // Чаще всего - занятый slug: на него стоит UNIQUE.
    return NextResponse.json({ error: String(e) }, { status: 400 })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { published } = await req.json()
  await dbJournalToggle(id, Boolean(published))
  return NextResponse.json({ ok: true })
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await dbJournalDelete(id)
  return NextResponse.json({ ok: true })
}
