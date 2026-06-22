import { NextRequest, NextResponse } from 'next/server'
import { dbEventById, dbEventUpsert, dbEventDelete, dbEventToggle } from '@/lib/db'

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return NextResponse.json(await dbEventById(id))
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const data = await req.json()
  return NextResponse.json(await dbEventUpsert(data, id))
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { published } = await req.json()
  await dbEventToggle(id, published)
  return NextResponse.json({ ok: true })
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await dbEventDelete(id)
  return NextResponse.json({ ok: true })
}
