import { NextRequest } from 'next/server'
import { guarded } from '../_guard'
import { pipeFindings, pipeFindingAdd } from '@/lib/pipeline'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const verdict = req.nextUrl.searchParams.get('verdict')
  const limit = Number(req.nextUrl.searchParams.get('limit') || 200)
  return guarded(req, () => pipeFindings(verdict, limit))
}

/** Ручная ссылка: сразу accepted, write.py напишет по ней пост. */
export async function POST(req: NextRequest) {
  return guarded(req, async () => {
    const { url, title = '', topic = '' } = await req.json()
    if (!url || !/^https?:\/\//.test(url)) throw new Error('нужен адрес с http(s)://')
    return (await pipeFindingAdd(url, title, topic)) ?? { duplicate: true }
  })
}
