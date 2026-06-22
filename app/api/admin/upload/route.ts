import { NextRequest, NextResponse } from 'next/server'
import { uploadImage } from '@/lib/storage'

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData()
    const file = form.get('file') as File
    if (!file) return NextResponse.json({ error: 'no file' }, { status: 400 })

    const buffer = Buffer.from(await file.arrayBuffer())
    const urls = await uploadImage(buffer, file.name, file.type)
    return NextResponse.json(urls)
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
