import { NextRequest, NextResponse } from 'next/server'
import { uploadImage, uploadVideo } from '@/lib/storage'

/**
 * Загрузка файлов админкой. Вход проверяется в proxy.ts на всём /api/admin,
 * здесь остаются ограничения на сам файл: без них маршрут работал как
 * открытый файловый склад на наших ключах хранилища.
 */
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif']
const VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime']
const MAX_IMAGE = 40 * 1024 * 1024
const MAX_VIDEO = 300 * 1024 * 1024

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData()
    const file = form.get('file') as File
    if (!file) return NextResponse.json({ error: 'файл не передан' }, { status: 400 })

    const isVideo = VIDEO_TYPES.includes(file.type)
    const isImage = IMAGE_TYPES.includes(file.type)
    if (!isVideo && !isImage) {
      return NextResponse.json({ error: `тип ${file.type || 'неизвестен'} не принимается` }, { status: 415 })
    }

    const limit = isVideo ? MAX_VIDEO : MAX_IMAGE
    if (file.size > limit) {
      return NextResponse.json(
        { error: `файл ${(file.size / 1048576).toFixed(1)} МБ больше предела ${limit / 1048576} МБ` },
        { status: 413 },
      )
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    // Видео (журнал) идёт мимо sharp: ему превью не сделать, кладём как есть.
    if (isVideo) {
      return NextResponse.json(await uploadVideo(buffer, file.name, file.type))
    }
    const urls = await uploadImage(buffer, file.name, file.type)
    return NextResponse.json(urls)
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
