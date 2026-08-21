import { notFound } from "next/navigation"
import { fetchArtworks, fetchEvents } from "@/lib/airtable"
import Nav from "@/components/Nav"
import Gallery from "@/components/Gallery"
import CosmicDescent from "@/components/scenes/CosmicDescent"
import Reveal from "@/components/Reveal"
import DiveButton from "@/components/DiveButton"
import StatTile from "@/components/StatTile"
import { TELEMETRY, VENUES } from "@/lib/site"
import { intlLocale, isLocale } from "@/i18n/config"
import { getDictionary } from "./dictionaries"

export const dynamic = 'force-dynamic'

export default async function Home({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  if (!isLocale(lang)) notFound()

  const [dict, artworks, events] = await Promise.all([
    getDictionary(lang),
    fetchArtworks(),
    fetchEvents(),
  ])
  const catalog = artworks.filter(a => a.inCatalog && a.imageUrl)
  const statLabels = dict.stat

  return (
    <>
      <Nav dict={dict.nav} locale={lang} hasEvents={events.length > 0} />

      <CosmicDescent cityLabels={dict.scene.cities}>
        {/* ── HERO (акт 1: тишина) ── */}
        <section style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", padding: "120px 24px 80px", textAlign: "center", position: "relative" }}>
          <div style={{ position: "relative", zIndex: 1, maxWidth: 800 }}>
            <div className="section-label" style={{ marginBottom: 24, fontSize: "0.9rem" }}>{dict.hero.kicker}</div>
            {/* Перенос строки задаётся словарём: по-немецки и по-японски
                заголовок ломается в другом месте, и жёсткий <br /> посреди
                фразы вставал бы поперёк смысла. */}
            <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "clamp(2.6rem, 9vw, 5.5rem)", lineHeight: 1.05, letterSpacing: "0.02em", marginBottom: 28 }}>
              {dict.hero.titleTop}
              {dict.hero.titleBottom ? <br /> : null}
              {dict.hero.titleBottom}
            </h1>
            <div className="fade-line" style={{ maxWidth: 400, margin: "0 auto 28px" }} />
            <p style={{ color: "#aaa", fontSize: "1.1rem", letterSpacing: "0.03em", marginBottom: 48, maxWidth: 560, marginLeft: "auto", marginRight: "auto" }}>
              {dict.hero.lead}
            </p>
            <a href="#gallery" style={{ display: "inline-block", padding: "16px 48px", border: "1px solid #c9a84c", color: "#c9a84c", textDecoration: "none", fontSize: "0.85rem", letterSpacing: "0.3em", textTransform: "uppercase" }}>
              {dict.hero.cta}
            </a>
            <div>
              <DiveButton label={dict.hero.dive} />
            </div>
          </div>
        </section>

        {/* ── ПЛОЩАДКИ (акт 7 начинается здесь визуально, данные требуют сверки) ── */}
        <section id="venues" style={{ padding: "80px 24px" }}>
          <div style={{ maxWidth: 1200, margin: "0 auto" }}>
            <div className="section-label" style={{ marginBottom: 8 }}>{dict.venues.label}</div>
            <div className="fade-line" style={{ marginBottom: 48 }} />
            <Reveal className="grid-venues" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 2 }}>
              {VENUES.map(v => {
                const t = dict.venues.items[v.id]
                return (
                  <div
                    key={v.id}
                    className="reveal-item"
                    style={{
                      background: v.current ? "#111008" : "#0d0d0d",
                      border: v.current ? "1px solid #4a3d18" : "1px solid #1a1a1a",
                      padding: "48px 40px",
                      transition: "border-color 0.3s",
                    }}
                  >
                    {v.current && (
                      <div style={{ color: "#c9a84c", fontSize: "0.7rem", letterSpacing: "0.28em", textTransform: "uppercase", marginBottom: 14 }}>
                        {dict.venues.now}
                      </div>
                    )}
                    <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.75rem", marginBottom: 16 }}>{t.name}</div>
                    <div style={{ color: "#c9a84c", fontSize: "1.15rem", marginBottom: 8 }}>{t.dates}</div>
                    <div style={{ color: "#777", fontSize: "1.05rem" }}>{t.address}</div>
                    {t.note && (
                      <div style={{ color: "#8a8a8a", fontSize: "0.9rem", lineHeight: 1.6, marginTop: 18 }}>{t.note}</div>
                    )}
                    {v.url && (
                      <a
                        href={v.url}
                        target="_blank"
                        rel="noopener"
                        style={{ display: "inline-block", marginTop: 16, color: "#c9a84c", fontSize: "0.8rem", letterSpacing: "0.18em", textTransform: "uppercase", textDecoration: "none", borderBottom: "1px solid #4a3d18", paddingBottom: 4 }}
                      >
                        {dict.venues.siteLink}
                      </a>
                    )}
                  </div>
                )
              })}
            </Reveal>
          </div>
        </section>

        {/* ── О ПРОЕКТЕ (акт 2: плотность → акт 5: манифест) ── */}
        <section id="about" style={{ padding: "80px 24px" }}>
          <div style={{ maxWidth: 1200, margin: "0 auto" }}>
            <p style={{ fontFamily: "var(--font-display)", fontSize: "1.3rem", lineHeight: 1.7, color: "#ddd", maxWidth: 760, marginBottom: 40 }}>
              {dict.about.manifesto}
            </p>
            <div className="grid-venues" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 1, marginBottom: 12 }}>
              {TELEMETRY.map(t => {
                const text = dict.telemetry[t.id]
                return (
                  <StatTile
                    key={t.id}
                    target={t.target}
                    kind={t.kind}
                    suffix={"suffix" in text ? text.suffix : undefined}
                    staticValue={"value" in text ? text.value : undefined}
                    label={text.label}
                    source={t.source}
                    sourceUrl={t.sourceUrl}
                    asOf={text.asOf}
                    trend={"trend" in text ? text.trend : undefined}
                    comparisons={"comparisons" in text ? text.comparisons : []}
                    intlLocale={intlLocale[lang]}
                    labels={statLabels}
                  />
                )
              })}
            </div>
            <p style={{ color: "#444", fontSize: "0.72rem", marginBottom: 64 }}>
              {dict.about.statsHint}
            </p>
          </div>
          <div className="grid-about" style={{ maxWidth: 1200, margin: "0 auto", display: "grid", gridTemplateColumns: "280px 1fr", gap: 80, alignItems: "start" }}>
            <div>
              <div className="section-label" style={{ marginBottom: 8 }}>{dict.about.label}</div>
              <div className="fade-line" />
            </div>
            <div>
              <p style={{ fontSize: "1.1rem", lineHeight: 1.85, color: "#999", marginBottom: 20 }}>
                {dict.about.p1}
              </p>
              <p style={{ fontSize: "1.05rem", lineHeight: 1.85, color: "#888", marginBottom: 20 }}>
                {dict.about.p2}
              </p>
              <p style={{ fontSize: "1.05rem", lineHeight: 1.85, color: "#666" }}>
                {dict.about.p3}
              </p>
            </div>
          </div>
        </section>
      </CosmicDescent>

      {/* ── ГАЛЕРЕЯ ── */}
      <Gallery artworks={catalog} dict={dict.gallery} />

      {/* ── КОМАНДА ── */}
      <section id="team" className="grain" style={{ padding: "80px 24px", position: "relative", background: "var(--earth-bg)" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div className="section-label" style={{ marginBottom: 8 }}>{dict.team.label}</div>
          <div className="fade-line" style={{ marginBottom: 48 }} />
          <Reveal className="grid-team" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 1 }}>
            {dict.team.members.map(p => (
              <div key={p.name} className="reveal-item" style={{ background: "#0d0d0d", padding: "32px 28px", borderTop: "2px solid #1a1a1a" }}>
                <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, color: "#c9a84c", fontSize: "1.3rem", marginBottom: 6 }}>{p.name}</div>
                <div style={{ fontSize: "0.85rem", color: "#555", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 12 }}>{p.role}</div>
                <div style={{ fontSize: "1.05rem", color: "#888", lineHeight: 1.75 }}>{p.desc}</div>
              </div>
            ))}
          </Reveal>
        </div>
      </section>

      {/* ── ПАРТНЁРЫ ── */}
      <section id="partners" className="grain" style={{ padding: "80px 24px", position: "relative", background: "var(--earth-bg)" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div className="section-label" style={{ marginBottom: 8 }}>{dict.partners.label}</div>
          <div className="fade-line" style={{ marginBottom: 48 }} />
          <Reveal className="grid-partners" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 1 }}>
            {dict.partners.items.map(p => (
              <div key={p.name} className="reveal-item" style={{ padding: "28px 0", borderTop: "1px solid #1a1a1a" }}>
                <div style={{ fontSize: "1.1rem", color: "#c9a84c", marginBottom: 8 }}>{p.name}</div>
                {p.desc && <div style={{ fontSize: "1rem", color: "#666", lineHeight: 1.6 }}>{p.desc}</div>}
              </div>
            ))}
          </Reveal>
        </div>
      </section>

      {/* ── СОБЫТИЯ ── */}
      {/* Пустой раздел с заглушкой "скоро появятся" выглядит как брошенный
          сайт. Пока событий нет, раздела нет вовсе - пункт меню тоже
          скрывается в Nav по этому же признаку. */}
      {events.length > 0 && (
        <section id="events" className="grain" style={{ padding: "80px 24px", borderTop: "1px solid #111", position: "relative", background: "var(--earth-bg)" }}>
          <div style={{ maxWidth: 1200, margin: "0 auto" }}>
            <div className="section-label" style={{ marginBottom: 8 }}>{dict.events.label}</div>
            <div className="fade-line" style={{ marginBottom: 48 }} />
            <Reveal className="grid-events" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 2 }}>
              {events.map(ev => (
                <div key={ev.id} className="reveal-item" style={{ background: "#0d0d0d", border: "1px solid #1a1a1a", overflow: "hidden" }}>
                  {ev.imageUrl && (
                    <div style={{ height: 200, overflow: "hidden" }}>
                      <img src={ev.imageUrl} alt={ev.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    </div>
                  )}
                  <div style={{ padding: "28px 28px 32px" }}>
                    {ev.type && <div className="section-label" style={{ marginBottom: 12 }}>{ev.type}</div>}
                    <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.35rem", lineHeight: 1.3, marginBottom: 12 }}>{ev.title}</div>
                    {(ev.date || ev.place) && (
                      <div style={{ color: "#c9a84c", fontSize: "1rem", marginBottom: 12 }}>
                        {ev.date}{ev.date && ev.place ? " · " : ""}{ev.place}
                      </div>
                    )}
                    {ev.description && <div style={{ fontSize: "1.05rem", color: "#888", lineHeight: 1.7 }}>{ev.description}</div>}
                    {ev.link && (
                      <a href={ev.link} target="_blank" rel="noopener noreferrer" style={{ display: "inline-block", marginTop: 16, fontSize: "0.75rem", letterSpacing: "0.2em", textTransform: "uppercase", color: "#c9a84c", textDecoration: "none", borderBottom: "1px solid #c9a84c44" }}>
                        {dict.events.more}
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </Reveal>
          </div>
        </section>
      )}

      {/* ── ИСТОРИЯ ── */}
      <section id="history" className="grain" style={{ padding: "80px 24px", borderTop: "1px solid #111", position: "relative", background: "var(--earth-bg)" }}>
        <div className="grid-history-outer" style={{ maxWidth: 1200, margin: "0 auto", display: "grid", gridTemplateColumns: "280px 1fr", gap: 80, alignItems: "start" }}>
          <div>
            <div className="section-label" style={{ marginBottom: 8 }}>{dict.history.label}</div>
            <div className="fade-line" />
            <p style={{ marginTop: 24, fontSize: "0.95rem", color: "#555", lineHeight: 1.7 }}>
              {dict.history.intro}
            </p>
          </div>
          <Reveal>
            {dict.history.items.map((item, i) => (
              <div key={item.year} className="grid-history-row reveal-item" style={{ display: "grid", gridTemplateColumns: "72px 1fr", gap: 28, paddingBottom: 36, paddingTop: i === 0 ? 0 : 36, borderTop: i === 0 ? "none" : "1px solid #1a1a1a" }}>
                <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.3rem", color: "#c9a84c", paddingTop: 2 }}>{item.year}</div>
                <div style={{ fontSize: "1rem", color: "#999", lineHeight: 1.8 }}>{item.text}</div>
              </div>
            ))}
          </Reveal>
        </div>
      </section>

      {/* ── БЛАГОДАРНОСТИ ── */}
      <section className="grain" style={{ padding: "80px 24px", borderTop: "1px solid #111", position: "relative", background: "var(--earth-bg)" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div className="section-label" style={{ marginBottom: 8 }}>{dict.thanks.label}</div>
          <div className="fade-line" style={{ marginBottom: 48 }} />
          <Reveal className="grid-thanks" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 1 }}>
            {dict.thanks.items.map(p => (
              <div key={p.name} className="reveal-item" style={{ padding: "32px 0", borderTop: "1px solid #1a1a1a" }}>
                <div style={{ fontSize: "0.78rem", letterSpacing: "0.16em", textTransform: "uppercase", color: "#c9a84c", marginBottom: 8 }}>{p.name}</div>
                <div style={{ fontSize: "0.85rem", color: "#444", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 12 }}>{p.title}</div>
                <div style={{ fontSize: "1.05rem", color: "#777", lineHeight: 1.75 }}>{p.text}</div>
              </div>
            ))}
          </Reveal>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ borderTop: "1px solid #1a1a1a", padding: "32px 24px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
          <span style={{ fontFamily: "var(--font-display)", color: "#c9a84c", fontSize: "0.9rem" }}>{dict.footer.brand}</span>
          <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
            <span style={{ color: "#5a5a5a", fontSize: "0.75rem" }}>{dict.footer.cities}</span>
            <span style={{ display: "flex", alignItems: "center", gap: 10, fontSize: "0.75rem" }}>
              <a href="https://xn--80afpgcdklbdb8ac0nmb.xn--p1ai" style={{ color: "#8a8a8a", textDecoration: "none" }}>
                экологиякосмоса.рф
              </a>
              <span style={{ color: "#3a3a3a" }}>·</span>
              <a href="https://cosmosecology.ru" style={{ color: "#8a8a8a", textDecoration: "none" }}>
                cosmosecology.ru
              </a>
            </span>
            <a href="https://notevibe.ru" target="_blank" rel="noopener" style={{ color: "#333", fontSize: "0.75rem", textDecoration: "none" }}>
              {dict.footer.credit}
            </a>
          </div>
        </div>
      </footer>

    </>
  )
}
