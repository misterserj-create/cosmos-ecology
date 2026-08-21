import { NextRequest, NextResponse } from 'next/server'
import { dbJournalTranslations, dbJournalTranslationSave } from '@/lib/db'

/**
 * Переводы одной публикации, по образцу работ. Вместе с текстами
 * переводится и адрес (slug): у английской публикации свой адрес.
 */
export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const data = await dbJournalTranslations(id)
  if (!data) return NextResponse.json({ error: 'not found' }, { status: 404 })
  return NextResponse.json(data)
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { lang, fields } = await req.json()
  try {
    await dbJournalTranslationSave(id, String(lang), fields || {})
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 400 })
  }
  return NextResponse.json(await dbJournalTranslations(id))
}
