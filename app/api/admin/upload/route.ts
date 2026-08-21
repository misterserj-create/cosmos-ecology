import { NextRequest, NextResponse } from 'next/server'
import { uploadImage, uploadVideo } from '@/lib/storage'

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData()
    const file = form.get('file') as File
    if (!file) return NextResponse.json({ error: 'no file' }, { status: 400 })

    const buffer = Buffer.from(await file.arrayBuffer())
    // Видео (журнал) идёт мимо sharp: ему превью не сделать, кладём как есть.
    if (file.type.startsWith('video/')) {
      return NextResponse.json(await uploadVideo(buffer, file.name, file.type))
    }
    const urls = await uploadImage(buffer, file.name, file.type)
    return NextResponse.json(urls)
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
