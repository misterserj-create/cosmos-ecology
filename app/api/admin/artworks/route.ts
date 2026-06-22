import { NextRequest, NextResponse } from 'next/server'
import { dbArtworks, dbArtworkUpsert } from '@/lib/db'

export async function GET() {
  const rows = await dbArtworks()
  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  const data = await req.json()
  const row = await dbArtworkUpsert(data)
  return NextResponse.json(row)
}
