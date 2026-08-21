import { NextRequest } from 'next/server'
import { guarded } from '../_guard'
import { pipeDrafts } from '@/lib/pipeline'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const status = req.nextUrl.searchParams.get('status')
  return guarded(req, () => pipeDrafts(status))
}
