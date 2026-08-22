import { NextRequest } from 'next/server'
import { guarded } from '../../_guard'
import { pipeFindingVerdict } from '@/lib/pipeline'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return guarded(req, async () => {
    const { id } = await params
    const { verdict } = await req.json()
    if (verdict !== 'accepted' && verdict !== 'rejected') throw new Error('verdict: accepted|rejected')
    await pipeFindingVerdict(Number(id), verdict)
    return { ok: true }
  })
}
