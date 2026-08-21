import { NextRequest } from 'next/server'
import { guarded } from '../_guard'
import { pipeSources } from '@/lib/pipeline'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  return guarded(req, () => pipeSources())
}
