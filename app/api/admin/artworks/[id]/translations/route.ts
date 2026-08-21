import { NextRequest, NextResponse } from 'next/server'
import { dbArtworkTranslations, dbArtworkTranslationSave } from '@/lib/db'

/**
 * Переводы одной работы. Отдельная ручка, а не расширение основной:
 * русская строка и переводы живут в разных таблицах, сохраняются
 * независимо, и мешать их в одном запросе значило бы переписывать
 * русский оригинал каждый раз, когда правят японский.
 */
export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const data = await dbArtworkTranslations(id)
  if (!data) return NextResponse.json({ error: 'not found' }, { status: 404 })
  return NextResponse.json(data)
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { lang, fields } = await req.json()
  try {
    await dbArtworkTranslationSave(id, String(lang), fields || {})
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 400 })
  }
  return NextResponse.json(await dbArtworkTranslations(id))
}
