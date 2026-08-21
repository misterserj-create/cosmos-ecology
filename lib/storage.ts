import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import sharp from 'sharp'

const BUCKET = 'cosmos-ecology'
const ENDPOINT = process.env.MINIO_ENDPOINT || 'http://127.0.0.1:9002'
const PUBLIC_URL = process.env.MINIO_PUBLIC_URL || ENDPOINT

function getClient() {
  return new S3Client({
    endpoint: ENDPOINT,
    region: 'us-east-1',
    credentials: {
      accessKeyId: process.env.MINIO_ACCESS_KEY || '',
      secretAccessKey: process.env.MINIO_SECRET_KEY || '',
    },
    forcePathStyle: true,
  })
}

export async function uploadImage(
  buffer: Buffer,
  filename: string,
  contentType = 'image/jpeg'
): Promise<{ imageUrl: string; thumbUrl: string }> {
  const client = getClient()
  const slug = `${Date.now()}-${filename.replace(/[^a-z0-9.]/gi, '_')}`

  // оригинал
  await client.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: `originals/${slug}`,
    Body: buffer,
    ContentType: contentType,
    ACL: 'public-read',
  }))

  // превью 400px
  const thumb = await sharp(buffer).resize(400).jpeg({ quality: 80 }).toBuffer()
  await client.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: `thumbs/${slug}`,
    Body: thumb,
    ContentType: 'image/jpeg',
    ACL: 'public-read',
  }))

  return {
    imageUrl: `${PUBLIC_URL}/${BUCKET}/originals/${slug}`,
    thumbUrl: `${PUBLIC_URL}/${BUCKET}/thumbs/${slug}`,
  }
}

/**
 * Видео для журнала: кладём как есть, без превью - sharp видео не читает.
 * Папка journal/video, та же, куда скрипт db/seed/journal_from_tg.py
 * заливает ролики из Telegram.
 */
export async function uploadVideo(
  buffer: Buffer,
  filename: string,
  contentType = 'video/mp4'
): Promise<{ videoUrl: string }> {
  const client = getClient()
  const slug = `${Date.now()}-${filename.replace(/[^a-z0-9.]/gi, '_')}`
  await client.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: `journal/video/${slug}`,
    Body: buffer,
    ContentType: contentType,
    ACL: 'public-read',
  }))
  return { videoUrl: `${PUBLIC_URL}/${BUCKET}/journal/video/${slug}` }
}
