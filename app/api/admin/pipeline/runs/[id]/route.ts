import { NextRequest } from 'next/server'
import { guarded } from '../../_guard'
import { pipeRunLog } from '@/lib/pipeline'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return guarded(req, async () => {
    const { id } = await params
    const row = await pipeRunLog(Number(id))
    if (!row) throw new Error('прогон не найден')
    return row
  })
}
