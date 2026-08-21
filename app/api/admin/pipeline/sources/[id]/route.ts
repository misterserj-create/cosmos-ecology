import { NextRequest } from 'next/server'
import { guarded } from '../../_guard'
import { pipeSourceToggle } from '@/lib/pipeline'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return guarded(req, async () => {
    const { id } = await params
    const { active } = await req.json()
    await pipeSourceToggle(Number(id), Boolean(active))
    return { ok: true }
  })
}
