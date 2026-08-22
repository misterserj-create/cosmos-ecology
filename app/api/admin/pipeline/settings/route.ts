import { NextRequest } from 'next/server'
import { guarded } from '../_guard'
import { pipeSettings, pipeSettingsSave } from '@/lib/pipeline'

export const dynamic = 'force-dynamic'

const KEYS = ['topics', 'thresholds', 'models', 'publish', 'schedule', 'limits', 'voice']

export async function GET(req: NextRequest) {
  return guarded(req, () => pipeSettings())
}

export async function PUT(req: NextRequest) {
  return guarded(req, async () => {
    const data = await req.json()
    const values: Record<string, unknown> = {}
    for (const k of KEYS) if (k in data) values[k] = data[k]
    if (values.publish && typeof values.publish === 'object') {
      const mode = (values.publish as { mode?: string }).mode
      if (mode !== 'manual' && mode !== 'auto') throw new Error('publish.mode: manual|auto')
    }
    await pipeSettingsSave(values)
    return { ok: true, saved: Object.keys(values) }
  })
}
