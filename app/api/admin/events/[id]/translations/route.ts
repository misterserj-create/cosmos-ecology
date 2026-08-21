import { NextRequest, NextResponse } from 'next/server'
import { dbEventTranslations, dbEventTranslationSave } from '@/lib/db'

/** Переводы одного события. Устройство то же, что и у работ. */
export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const data = await dbEventTranslations(id)
  if (!data) return NextResponse.json({ error: 'not found' }, { status: 404 })
  return NextResponse.json(data)
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { lang, fields } = await req.json()
  try {
    await dbEventTranslationSave(id, String(lang), fields || {})
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 400 })
  }
  return NextResponse.json(await dbEventTranslations(id))
}
