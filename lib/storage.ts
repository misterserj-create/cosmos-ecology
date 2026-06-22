import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import sharp from 'sharp'

const BUCKET = 'cosmos-ecology'
const PUBLIC_URL = process.env.MINIO_PUBLIC_URL || 'http://185.125.103.160:9002'

function getClient() {
  return new S3Client({
    endpoint: process.env.MINIO_ENDPOINT || 'http://185.125.103.160:9002',
    region: 'us-east-1',
    credentials: {
      accessKeyId: process.env.MINIO_ACCESS_KEY || 'resonance_admin',
      secretAccessKey: process.env.MINIO_SECRET_KEY || 'Res0nance_MinIO_2026!',
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
