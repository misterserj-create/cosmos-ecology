import { NextRequest, NextResponse } from 'next/server'
import { isAdmin } from '@/lib/pipeline'

/** Общая обёртка маршрутов тракта: проверка входа и перевод ошибок в JSON. */
export async function guarded(req: NextRequest, fn: () => Promise<unknown>) {
  if (!isAdmin(req)) return NextResponse.json({ error: 'нет доступа' }, { status: 401 })
  try {
    return NextResponse.json(await fn())
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
