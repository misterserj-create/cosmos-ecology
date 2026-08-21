import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { fetchEvents, fetchJournalPost, type JournalPost } from "@/lib/content"
import { SITE_NAME, SITE_URL } from "@/lib/site"
import Nav from "@/components/Nav"
import SiteFooter from "@/components/SiteFooter"
import { formatJournalDate } from "@/components/JournalCard"
import {
  defaultLocale,
  htmlLang,
  intlLocale,
  isLocale,
  localePath,
  locales,
  ogLocale,
  type Locale,
} from "@/i18n/config"
import { getDictionary } from "../../dictionaries"

export const dynamic = "force-dynamic"

/** Адреса публикации на всех языках: у каждого языка свой slug. */
function postPaths(post: JournalPost): Record<Locale, string> {
  const map = {} as Record<Locale, string>
  for (const l of locales) map[l] = localePath(l, `/journal/${post.slugs[l]}`)
  return map
}

function hreflangMap(post: JournalPost): Record<string, string> {
  const paths = postPaths(post)
  const map: Record<string, string> = {}
  for (const l of locales) map[htmlLang[l]] = paths[l]
  map["x-default"] = paths[defaultLocale]
  return map
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string; slug: string }>
}): Promise<Metadata> {
  const { lang, slug } = await params
  if (!isLocale(lang)) return {}
  const post = await fetchJournalPost(slug, lang)
  if (!post) return {}
  const paths = postPaths(post)
  const title = `${post.title} · ${SITE_NAME}`
  const description = post.excerpt || post.paragraphs[0] || ""
  const image = post.coverUrl || "/og.jpg"
  return {
    title,
    description,
    alternates: {
      canonical: paths[lang],
      languages: hreflangMap(post),
    },
    openGraph: {
      type: "article",
      url: `${SITE_URL}${paths[lang]}`,
      siteName: `${SITE_NAME} 2026`,
      title,
      description,
      locale: ogLocale[lang],
      publishedTime: post.date || undefined,
      images: [{ url: image, alt: post.title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  }
}

const URL_RE = /(https?:\/\/[^\s<>«»"']+[^\s<>«»"'.,;:!?)])/g

/** Голые адреса в тексте превращаем в ссылки; остальное - как есть. */
function linkify(text: string): React.ReactNode[] {
  const parts = text.split(URL_RE)
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <a key={i} href={part} target="_blank" rel="noopener noreferrer">{part.replace(/^https?:\/\//, "")}</a>
    ) : (
      part
    )
  )
}

export default async function JournalPostPage({
  params,
}: {
  params: Promise<{ lang: string; slug: string }>
}) {
  const { lang, slug } = await params
  if (!isLocale(lang)) notFound()

  const [dict, post, events] = await Promise.all([
    getDictionary(lang),
    fetchJournalPost(slug, lang),
    fetchEvents(lang),
  ])
  if (!post) notFound()

  const paths = postPaths(post)
  const dateText = formatJournalDate(post.date, lang)
  const gallery = post.galleryUrls.filter(u => u !== post.coverUrl)

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.excerpt,
    datePublished: post.date || undefined,
    inLanguage: intlLocale[lang],
    image: post.coverUrl || `${SITE_URL}/og.jpg`,
    url: `${SITE_URL}${paths[lang]}`,
    publisher: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
  }

  return (
    <>
      <Nav dict={dict.nav} locale={lang} hasEvents={events.length > 0} langPaths={paths} solid={Boolean(post.coverUrl)} />

      <main className="grain" style={{ position: "relative", background: "var(--earth-bg)", paddingBottom: 80 }}>
        {/* Обложка во всю ширину. Без обложки - просто отступ под шапку. */}
        {post.coverUrl ? (
          <div style={{ position: "relative", height: "min(70vh, 720px)", overflow: "hidden", background: "#111" }}>
            <img src={post.coverUrl} alt={post.title} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(8,8,8,0.35) 0%, transparent 35%, rgba(10,8,6,0.9) 100%)" }} />
          </div>
        ) : (
          <div style={{ height: 120 }} />
        )}

        <article style={{ maxWidth: 720, margin: "0 auto", padding: "0 24px" }}>
          <header style={{ marginTop: post.coverUrl ? -96 : 0, position: "relative", marginBottom: 40 }}>
            <a href={localePath(lang, "/journal")} className="section-label" style={{ display: "inline-block", textDecoration: "none", marginBottom: 20 }}>
              {dict.journal.back}
            </a>
            <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "clamp(1.75rem, 4vw, 2.6rem)", lineHeight: 1.15, letterSpacing: "0.01em", marginBottom: 16 }}>
              {post.title}
            </h1>
            {dateText && (
              <div style={{ color: "#c9a84c", fontSize: "0.7rem", letterSpacing: "0.28em", textTransform: "uppercase" }}>{dateText}</div>
            )}
            <div className="fade-line" style={{ maxWidth: 400, marginTop: 24 }} />
          </header>

          <div className="journal-body">
            {post.excerpt && <p className="journal-lead">{linkify(post.excerpt)}</p>}
            {post.paragraphs.map((p, i) => (
              <p key={i}>{linkify(p)}</p>
            ))}
          </div>

          {post.videoUrls.length > 0 && (
            <section style={{ marginTop: 48 }}>
              <div className="section-label" style={{ marginBottom: 8 }}>{dict.journal.video}</div>
              <div className="fade-line" style={{ marginBottom: 24 }} />
              {post.videoUrls.map(url => (
                <video
                  key={url}
                  controls
                  preload="metadata"
                  playsInline
                  // Вертикальные ролики из Telegram: ограничиваем высоту,
                  // иначе один ролик занимает два экрана.
                  style={{ display: "block", maxWidth: "100%", maxHeight: "70vh", margin: "0 auto 16px", background: "#000", border: "1px solid #1a1a1a" }}
                >
                  <source src={url} />
                </video>
              ))}
            </section>
          )}

          {gallery.length > 0 && (
            <section style={{ marginTop: 48 }}>
              <div className="section-label" style={{ marginBottom: 8 }}>{dict.journal.gallery}</div>
              <div className="fade-line" style={{ marginBottom: 24 }} />
              <div className="grid-journal-gallery" style={{ display: "grid", gridTemplateColumns: gallery.length === 1 ? "1fr" : "1fr 1fr", gap: 2 }}>
                {gallery.map(url => (
                  <a key={url} href={url} target="_blank" rel="noopener" style={{ display: "block", background: "#0d0d0d", border: "1px solid #1a1a1a", overflow: "hidden" }}>
                    <img src={url} alt="" loading="lazy" style={{ width: "100%", display: "block", aspectRatio: "4 / 3", objectFit: "cover" }} />
                  </a>
                ))}
              </div>
            </section>
          )}

          {post.sourceLinks.length > 0 && (
            <section style={{ marginTop: 48, borderTop: "1px solid #1a1a1a", paddingTop: 28 }}>
              <div className="section-label" style={{ marginBottom: 16 }}>{dict.journal.sources}</div>
              <ul style={{ listStyle: "none", display: "grid", gap: 10 }}>
                {post.sourceLinks.map(url => (
                  <li key={url}>
                    <a href={url} target="_blank" rel="noopener noreferrer" style={{ color: "#8a8a8a", fontSize: "0.85rem", textDecoration: "none", borderBottom: "1px solid #1a1a1a", wordBreak: "break-all" }}>
                      {url.replace(/^https?:\/\//, "")}
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </article>
      </main>

      <SiteFooter dict={dict.footer} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </>
  )
}
