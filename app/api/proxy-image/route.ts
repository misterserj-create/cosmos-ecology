export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const url = searchParams.get('url')

  if (!url) {
    return new Response('Missing url parameter', { status: 400 })
  }

  try {
    const response = await fetch(decodeURIComponent(url))

    if (!response.ok) {
      return new Response('Failed to fetch image', { status: response.status })
    }

    const buffer = await response.arrayBuffer()
    const contentType = response.headers.get('content-type') || 'image/jpeg'

    return new Response(buffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400, immutable',
      },
    })
  } catch (error) {
    console.error('Proxy error:', error)
    return new Response('Failed to proxy image', { status: 500 })
  }
}
