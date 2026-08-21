import { intlLocale, localePath, type Locale } from "@/i18n/config"
import type { JournalPost } from "@/lib/content"

/** Дата публикации словами на языке страницы: «4 марта 2026», «March 4, 2026». */
export function formatJournalDate(date: string, locale: Locale): string {
  if (!date) return ""
  const [y, m, d] = date.split("-").map(Number)
  if (!y || !m || !d) return date
  return new Intl.DateTimeFormat(intlLocale[locale], { day: "numeric", month: "long", year: "numeric" })
    .format(new Date(Date.UTC(y, m - 1, d, 12)))
}

/**
 * Карточка публикации в ленте и в блоке на главной. Тот же ритм, что у
 * карточек событий: фон #0d0d0d, граница #1a1a1a, обложка сверху.
 */
export default function JournalCard({ post, locale }: { post: JournalPost; locale: Locale }) {
  const href = localePath(locale, `/journal/${post.slug}`)
  return (
    <a href={href} className="reveal-item journal-card" style={{ display: "block", background: "#0d0d0d", border: "1px solid #1a1a1a", overflow: "hidden", textDecoration: "none", color: "inherit" }}>
      <div style={{ height: 220, overflow: "hidden", background: "#111" }}>
        {post.coverUrl ? (
          <img src={post.coverUrl} alt={post.title} loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        ) : (
          <div style={{ width: "100%", height: "100%", background: "linear-gradient(160deg, #0d0d0d, #1a1608)" }} />
        )}
      </div>
      <div style={{ padding: "28px 28px 32px" }}>
        <div style={{ color: "#c9a84c", fontSize: "0.7rem", letterSpacing: "0.28em", textTransform: "uppercase", marginBottom: 14 }}>
          {formatJournalDate(post.date, locale)}
        </div>
        <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.35rem", lineHeight: 1.3, marginBottom: 12 }}>
          {post.title}
        </div>
        {post.excerpt && (
          <div className="journal-excerpt" style={{ fontSize: "1.05rem", color: "#888", lineHeight: 1.7 }}>{post.excerpt}</div>
        )}
      </div>
    </a>
  )
}
