import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { fetchEvents, fetchJournal } from "@/lib/content"
import { SITE_NAME, SITE_URL } from "@/lib/site"
import Nav from "@/components/Nav"
import Reveal from "@/components/Reveal"
import SiteFooter from "@/components/SiteFooter"
import JournalCard from "@/components/JournalCard"
import { alternateLanguages, isLocale, localePath, ogLocale } from "@/i18n/config"
import { getDictionary } from "../dictionaries"

export const dynamic = "force-dynamic"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>
}): Promise<Metadata> {
  const { lang } = await params
  if (!isLocale(lang)) return {}
  const dict = await getDictionary(lang)
  const title = `${dict.journal.title} · ${SITE_NAME} 2026`
  const path = localePath(lang, "/journal")
  return {
    title,
    description: dict.journal.description,
    alternates: {
      canonical: path,
      languages: alternateLanguages("/journal"),
    },
    openGraph: {
      type: "website",
      url: `${SITE_URL}${path}`,
      siteName: `${SITE_NAME} 2026`,
      title,
      description: dict.journal.description,
      locale: ogLocale[lang],
      images: [{ url: "/og.jpg", width: 1200, height: 630, alt: dict.meta.ogImageAlt }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: dict.journal.description,
      images: ["/og.jpg"],
    },
  }
}

export default async function JournalPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  if (!isLocale(lang)) notFound()

  const [dict, posts, events] = await Promise.all([
    getDictionary(lang),
    fetchJournal(lang),
    fetchEvents(lang),
  ])

  return (
    <>
      <Nav dict={dict.nav} locale={lang} hasEvents={events.length > 0} />

      <main className="grain" style={{ position: "relative", background: "var(--earth-bg)", padding: "140px 24px 80px", minHeight: "70vh" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div className="section-label" style={{ marginBottom: 8 }}>{dict.journal.label}</div>
          <div className="fade-line" style={{ marginBottom: 24 }} />
          <p style={{ fontFamily: "var(--font-display)", fontSize: "1.3rem", lineHeight: 1.7, color: "#ddd", maxWidth: 760, marginBottom: 48 }}>
            {dict.journal.description}
          </p>

          {posts.length === 0 ? (
            <p style={{ color: "#555", fontSize: "0.95rem" }}>{dict.journal.empty}</p>
          ) : (
            <Reveal className="grid-journal" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 2 }}>
              {posts.map(post => (
                <JournalCard key={post.id} post={post} locale={lang} />
              ))}
            </Reveal>
          )}
        </div>
      </main>

      <SiteFooter dict={dict.footer} />
    </>
  )
}
