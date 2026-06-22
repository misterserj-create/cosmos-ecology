import { NextRequest, NextResponse } from 'next/server'
import { dbArtworkUpsert, dbArtworkDelete, dbArtworkToggle, dbArtworkById } from '@/lib/db'

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const row = await dbArtworkById(id)
  return NextResponse.json(row)
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await params
  const data = await req.json()
  const row = await dbArtworkUpsert(data)
  return NextResponse.json(row)
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { in_catalog } = await req.json()
  await dbArtworkToggle(id, in_catalog)
  return NextResponse.json({ ok: true })
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await dbArtworkDelete(id)
  return NextResponse.json({ ok: true })
}
