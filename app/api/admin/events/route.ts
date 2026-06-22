import { NextRequest, NextResponse } from 'next/server'
import { dbEvents, dbEventUpsert } from '@/lib/db'

export async function GET() {
  const rows = await dbEvents()
  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  const data = await req.json()
  const row = await dbEventUpsert(data)
  return NextResponse.json(row)
}
