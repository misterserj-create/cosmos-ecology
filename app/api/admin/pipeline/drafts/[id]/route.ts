import { NextRequest } from 'next/server'
import { guarded } from '../../_guard'
import { pipeDraft, pipeDraftAction, type DraftAction } from '@/lib/pipeline'

export const dynamic = 'force-dynamic'

const ACTIONS: DraftAction[] = ['approve', 'reject', 'rewrite', 'publish_now', 'edit', 'unpublish_flag', 'regen_image']

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return guarded(req, async () => {
    const { id } = await params
    const row = await pipeDraft(Number(id))
    if (!row) throw new Error('черновик не найден')
    return row
  })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return guarded(req, async () => {
    const { id } = await params
    const { action, body, title } = await req.json()
    if (!ACTIONS.includes(action)) throw new Error(`action: ${ACTIONS.join('|')}`)
    if (action === 'edit' && typeof body === 'string' && body.includes('—')) {
      throw new Error('в тексте длинное тире «—», замените на «–»')
    }
    await pipeDraftAction(Number(id), action, { body, title })
    return { ok: true }
  })
}
