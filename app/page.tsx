import { fetchArtworks } from "@/lib/airtable"
import Nav from "@/components/Nav"
import Gallery from "@/components/Gallery"

export default async function Home() {
  const artworks = await fetchArtworks()
  const catalog = artworks.filter(a => a.inCatalog && a.imageUrl)

  return (
    <>
      <Nav />

      {/* ── HERO ── */}
      <section style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "80px 24px 60px", textAlign: "center", position: "relative" }}>
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at center, #1a1200 0%, #080808 70%)", zIndex: 0 }} />
        <div style={{ position: "relative", zIndex: 1, maxWidth: 800 }}>
          <div className="section-label" style={{ marginBottom: 24 }}>Выставочный проект · 2026</div>
          <h1 style={{ fontFamily: "var(--font-playfair)", fontWeight: 700, fontSize: "clamp(2.5rem, 8vw, 5.5rem)", lineHeight: 1.05, letterSpacing: "0.03em", textTransform: "uppercase", marginBottom: 24 }}>
            Экология<br />Космоса
          </h1>
          <div className="fade-line" style={{ maxWidth: 400, margin: "0 auto 24px" }} />
          <p style={{ color: "#888", fontSize: "0.9rem", letterSpacing: "0.05em", marginBottom: 48 }}>
            К 65-летию полёта Юрия Гагарина
          </p>
          <a href="#gallery" style={{ display: "inline-block", padding: "14px 40px", border: "1px solid #c9a84c", color: "#c9a84c", textDecoration: "none", fontSize: "0.7rem", letterSpacing: "0.3em", textTransform: "uppercase" }}>
            Смотреть галерею
          </a>
        </div>
      </section>

      {/* ── ПЛОЩАДКИ ── */}
      <section id="venues" style={{ padding: "80px 24px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div className="section-label" style={{ marginBottom: 8 }}>Площадки</div>
          <div className="fade-line" style={{ marginBottom: 48 }} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}>
            {[
              { name: "Галерея «Печатники»", dates: "6 марта — 19 апреля", address: "Москва, ул. Гурьянова, 30" },
              { name: "Музей «Спутник»", dates: "15 марта — 15 июня", address: "Москва, Воробьёвы горы" },
            ].map(v => (
              <div key={v.name} style={{ background: "#0d0d0d", border: "1px solid #1a1a1a", padding: "48px 40px" }}>
                <div style={{ fontFamily: "var(--font-playfair)", fontWeight: 700, fontSize: "1.5rem", marginBottom: 16 }}>{v.name}</div>
                <div style={{ color: "#c9a84c", fontSize: "0.9rem", marginBottom: 8 }}>{v.dates}</div>
                <div style={{ color: "#555", fontSize: "0.8rem" }}>{v.address}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── О ПРОЕКТЕ ── */}
      <section id="about" style={{ padding: "80px 24px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "grid", gridTemplateColumns: "280px 1fr", gap: 80, alignItems: "start" }}>
          <div>
            <div className="section-label" style={{ marginBottom: 8 }}>О проекте</div>
            <div className="fade-line" />
          </div>
          <div>
            <p style={{ fontFamily: "var(--font-playfair)", fontSize: "1.15rem", lineHeight: 1.7, color: "#ddd", marginBottom: 24 }}>
              Выставка посвящена актуальным вопросам техногенного воздействия на околоземную орбиту и проблеме космического мусора.
            </p>
            <p style={{ fontSize: "0.9rem", lineHeight: 1.8, color: "#888", marginBottom: 16 }}>
              В экспозиции представлены работы художников Сергея Кожуховского, Татьяны Кокоревой и Елизаветы Козырь. Авторы исследуют взаимодействие человека с внеземным пространством через призму экологической ответственности и устойчивого развития.
            </p>
            <p style={{ fontSize: "0.82rem", lineHeight: 1.8, color: "#555" }}>
              Проект, чьи работы уже пополнили Музейный фонд РФ после экспонирования в Государственном музее истории космонавтики имени К.&nbsp;Э.&nbsp;Циолковского, объединяет науку и искусство.
            </p>
          </div>
        </div>
      </section>

      {/* ── ГАЛЕРЕЯ ── */}
      <Gallery artworks={catalog} />

      {/* ── КОМАНДА ── */}
      <section id="team" style={{ padding: "80px 24px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div className="section-label" style={{ marginBottom: 8 }}>Участники</div>
          <div className="fade-line" style={{ marginBottom: 48 }} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 1 }}>
            {[
              { name: "Сергей Кожуховский", role: "Экохудожник, автор идеи", desc: "Финалист премии президентской платформы «Россия – страна возможностей». Трансформирует техногенные отходы в художественные образы." },
              { name: "Елизавета Козырь", role: "Художник-монументалист", desc: "Реставратор, участвовала в восстановлении святынь храма Воскресения Христова в Иерусалиме." },
              { name: "Татьяна Кокорева", role: "Оперная певица, мастер прикладного искусства", desc: "Работает с материей небесных тел." },
              { name: "Варвара Хазова", role: "Видеохудожник", desc: "Автор документального исследования «Космический мусор»." },
              { name: "Татьяна Фатеева", role: "Фотограф и медиахудожник", desc: "Запечатлела красоту соприкосновения человека и звёзд." },
              { name: "Элина Папас", role: "Исполнительный продюсер", desc: "Куратор Арт-клуба Сколково, выпускница бизнес-школы Сколково и Лондонской школы бизнеса. Магистр РАНХиГС, программа «Управление в арт-бизнесе»." },
            ].map(p => (
              <div key={p.name} style={{ background: "#0d0d0d", padding: "32px 28px", borderTop: "2px solid #1a1a1a" }}>
                <div style={{ fontFamily: "var(--font-playfair)", fontStyle: "italic", color: "#c9a84c", fontSize: "1.05rem", marginBottom: 6 }}>{p.name}</div>
                <div style={{ fontSize: "0.68rem", color: "#555", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 12 }}>{p.role}</div>
                <div style={{ fontSize: "0.82rem", color: "#777", lineHeight: 1.7 }}>{p.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── ПАРТНЁРЫ ── */}
      <section id="partners" style={{ padding: "80px 24px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div className="section-label" style={{ marginBottom: 8 }}>Партнёры</div>
          <div className="fade-line" style={{ marginBottom: 48 }} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 1 }}>
            {[
              { name: "Принцип НОВО", desc: "Стратегический партнер и со-архитектор среды" },
              { name: "Platform.web-ar.studio", desc: "Технологический партнер, дополненная реальность" },
              { name: "Арт-клуб «Сколково»", desc: "Президент: Ксения Макарчук" },
              { name: "«Фестиваль-строй»", desc: "Застройщик и организатор фестивалей" },
              { name: "Коврижка Зарайская", desc: "Гастрономический бренд Зарайска" },
              { name: "Ecodao.ru", desc: "Главная афиша России в сфере устойчивого развития" },
              { name: "«айФлекс»", desc: "Российский разработчик, 20 лет на рынке" },
              { name: "Департамент культуры Москвы", desc: "" },
            ].map(p => (
              <div key={p.name} style={{ padding: "24px 0", borderTop: "1px solid #1a1a1a" }}>
                <div style={{ fontSize: "0.82rem", color: "#c9a84c", marginBottom: 6 }}>{p.name}</div>
                {p.desc && <div style={{ fontSize: "0.75rem", color: "#555", lineHeight: 1.6 }}>{p.desc}</div>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ borderTop: "1px solid #1a1a1a", padding: "32px 24px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
          <span style={{ fontFamily: "var(--font-playfair)", color: "#c9a84c", fontSize: "0.9rem" }}>Экология Космоса 2026</span>
          <span style={{ color: "#333", fontSize: "0.75rem" }}>Москва · cosmosecology.ru</span>
        </div>
      </footer>

      <style>{`
        @media (max-width: 768px) {
          section > div[style*="grid-template-columns: 1fr 1fr"] { grid-template-columns: 1fr !important; }
          section > div[style*="grid-template-columns: 280px"] { grid-template-columns: 1fr !important; gap: 32px !important; }
        }
      `}</style>
    </>
  )
}
