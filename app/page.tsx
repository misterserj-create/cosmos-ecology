import { fetchArtworks, fetchEvents } from "@/lib/airtable"
import Nav from "@/components/Nav"
import Gallery from "@/components/Gallery"

export default async function Home() {
  const [artworks, events] = await Promise.all([fetchArtworks(), fetchEvents()])
  const catalog = artworks.filter(a => a.inCatalog && a.imageUrl)

  return (
    <>
      <Nav />

      {/* ── HERO ── */}
      <section style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "80px 24px 60px", textAlign: "center", position: "relative" }}>
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at center, #1a1200 0%, #080808 70%)", zIndex: 0 }} />
        <div style={{ position: "relative", zIndex: 1, maxWidth: 800 }}>
          <div className="section-label" style={{ marginBottom: 24, fontSize: "0.8rem" }}>Выставочный проект · 2026</div>
          <h1 style={{ fontFamily: "var(--font-playfair)", fontWeight: 700, fontSize: "clamp(2.5rem, 8vw, 5.5rem)", lineHeight: 1.05, letterSpacing: "0.03em", textTransform: "uppercase", marginBottom: 24 }}>
            Экология<br />Космоса
          </h1>
          <div className="fade-line" style={{ maxWidth: 400, margin: "0 auto 24px" }} />
          <p style={{ color: "#aaa", fontSize: "1rem", letterSpacing: "0.05em", marginBottom: 48 }}>
            К 65-летию полёта Юрия Гагарина
          </p>
          <a href="#gallery" style={{ display: "inline-block", padding: "14px 40px", border: "1px solid #c9a84c", color: "#c9a84c", textDecoration: "none", fontSize: "0.8rem", letterSpacing: "0.3em", textTransform: "uppercase" }}>
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
                <div style={{ fontFamily: "var(--font-playfair)", fontWeight: 700, fontSize: "1.6rem", marginBottom: 16 }}>{v.name}</div>
                <div style={{ color: "#c9a84c", fontSize: "1.05rem", marginBottom: 8 }}>{v.dates}</div>
                <div style={{ color: "#777", fontSize: "0.95rem" }}>{v.address}</div>
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
            <p style={{ fontFamily: "var(--font-playfair)", fontSize: "1.25rem", lineHeight: 1.7, color: "#ddd", marginBottom: 24 }}>
              Выставка посвящена актуальным вопросам техногенного воздействия на околоземную орбиту и проблеме космического мусора.
            </p>
            <p style={{ fontSize: "1rem", lineHeight: 1.8, color: "#999", marginBottom: 16 }}>
              В экспозиции представлены работы художников Сергея Кожуховского, Татьяны Кокоревой и Елизаветы Козырь. Авторы исследуют взаимодействие человека с внеземным пространством через призму экологической ответственности и устойчивого развития.
            </p>
            <p style={{ fontSize: "0.95rem", lineHeight: 1.8, color: "#666" }}>
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
                <div style={{ fontFamily: "var(--font-playfair)", fontStyle: "italic", color: "#c9a84c", fontSize: "1.2rem", marginBottom: 6 }}>{p.name}</div>
                <div style={{ fontSize: "0.8rem", color: "#555", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 12 }}>{p.role}</div>
                <div style={{ fontSize: "0.95rem", color: "#888", lineHeight: 1.75 }}>{p.desc}</div>
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
              <div key={p.name} style={{ padding: "28px 0", borderTop: "1px solid #1a1a1a" }}>
                <div style={{ fontSize: "1rem", color: "#c9a84c", marginBottom: 8 }}>{p.name}</div>
                {p.desc && <div style={{ fontSize: "0.9rem", color: "#666", lineHeight: 1.6 }}>{p.desc}</div>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── СОБЫТИЯ ── */}
      <section id="events" style={{ padding: "80px 24px", borderTop: "1px solid #111" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div className="section-label" style={{ marginBottom: 8 }}>Мероприятия и новости</div>
          <div className="fade-line" style={{ marginBottom: 48 }} />
          {events.length === 0 ? (
            <p style={{ color: "#444", fontSize: "0.9rem" }}>Мероприятия скоро появятся</p>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 2 }}>
              {events.map(ev => (
                <div key={ev.id} style={{ background: "#0d0d0d", border: "1px solid #1a1a1a", overflow: "hidden" }}>
                  {ev.imageUrl && (
                    <div style={{ height: 200, overflow: "hidden" }}>
                      <img src={ev.imageUrl} alt={ev.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    </div>
                  )}
                  <div style={{ padding: "28px 28px 32px" }}>
                    {ev.type && <div className="section-label" style={{ marginBottom: 12 }}>{ev.type}</div>}
                    <div style={{ fontFamily: "var(--font-playfair)", fontWeight: 700, fontSize: "1.2rem", lineHeight: 1.3, marginBottom: 12 }}>{ev.title}</div>
                    {(ev.date || ev.place) && (
                      <div style={{ color: "#c9a84c", fontSize: "0.9rem", marginBottom: 12 }}>
                        {ev.date}{ev.date && ev.place ? " · " : ""}{ev.place}
                      </div>
                    )}
                    {ev.description && <div style={{ fontSize: "0.95rem", color: "#888", lineHeight: 1.7 }}>{ev.description}</div>}
                    {ev.link && (
                      <a href={ev.link} target="_blank" rel="noopener noreferrer" style={{ display: "inline-block", marginTop: 16, fontSize: "0.75rem", letterSpacing: "0.2em", textTransform: "uppercase", color: "#c9a84c", textDecoration: "none", borderBottom: "1px solid #c9a84c44" }}>
                        Подробнее →
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── ИСТОРИЯ ── */}
      <section id="history" style={{ padding: "80px 24px", borderTop: "1px solid #111" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "grid", gridTemplateColumns: "280px 1fr", gap: 80, alignItems: "start" }}>
          <div>
            <div className="section-label" style={{ marginBottom: 8 }}>История проекта</div>
            <div className="fade-line" />
            <p style={{ marginTop: 24, fontSize: "0.95rem", color: "#555", lineHeight: 1.7 }}>
              «Экология космоса» выросла из слияния двух авторских взглядов на технологический след человечества.
            </p>
          </div>
          <div>
            {[
              { year: "2018", text: "Монументальный художник Елизавета Козырь создала концептуальную серию работ, заложив визуальный фундамент темы." },
              { year: "2021", text: "Сергей Кожуховский, работая в ППК РЭО, создал первые объекты из электронных компонентов и дал проекту официальное название." },
              { year: "2022", text: "«Экология космоса» вышла в публичное пространство. Осенью проект представлен в инновационном центре «Ренова Лаб»." },
              { year: "2023", text: "Ключевая выставка в Калуге, в ГМИК им. К.\u00a0Э.\u00a0Циолковского. В рамках «Экософии» экспозиция прошла в Архангельске, Тюмени, Санкт-Петербурге, Нижнем Новгороде, Екатеринбурге и Челябинске." },
              { year: "2026", text: "Трансформируя промышленную археологию в искусство будущего, проект продолжает масштабировать смыслы на стыке экологии и космонавтики." },
            ].map((item, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "72px 1fr", gap: 28, paddingBottom: 36, paddingTop: i === 0 ? 0 : 36, borderTop: i === 0 ? "none" : "1px solid #1a1a1a" }}>
                <div style={{ fontFamily: "var(--font-playfair)", fontWeight: 700, fontSize: "1.3rem", color: "#c9a84c", paddingTop: 2 }}>{item.year}</div>
                <div style={{ fontSize: "1rem", color: "#999", lineHeight: 1.8 }}>{item.text}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── БЛАГОДАРНОСТИ ── */}
      <section style={{ padding: "80px 24px", borderTop: "1px solid #111" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div className="section-label" style={{ marginBottom: 8 }}>Благодарности</div>
          <div className="fade-line" style={{ marginBottom: 48 }} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 1 }}>
            {[
              { name: "Павел Мусс", title: "Генеральный директор «Принцип НОВО»", text: "За многолетнюю стратегическую поддержку проектов арт-группы «Осознанность» и личное участие в развитии нашей экосистемы." },
              { name: "Ксения Макарчук", title: "Президент Арт-клуба «Сколково»", text: "За всестороннюю помощь, мощный информационный ресурс и участие в проектах арт-группы «Осознанность»." },
              { name: "Елена Волкова", title: "Руководитель издательства «Русский мир медиа»", text: "За безупречную организацию выставочных циклов в «Ренова Лаб» и ГМИК им. К.\u00a0Э.\u00a0Циолковского." },
              { name: "Наталья Абакумова", title: "Директор ГМИК им. К.\u00a0Э.\u00a0Циолковского", text: "За проведение выставки и высокую экспертную оценку, результатом которой стала передача части работ в фонды музея и Государственный каталог РФ." },
              { name: "Денис Щербаков", title: "Основатель «Фестиваль-Строй»", text: "За профессиональную застройку экспозиций, предоставление выставочной инфраструктуры и активное партнёрство с 2022 года." },
              { name: "Андрей Беляев", title: "Генеральный директор «Айфлекс»", text: "За надёжное партнёрство, проверенное годами, и неизменную поддержку наших инициатив." },
            ].map(p => (
              <div key={p.name} style={{ padding: "32px 0", borderTop: "1px solid #1a1a1a" }}>
                <div style={{ fontFamily: "var(--font-playfair)", fontStyle: "italic", color: "#c9a84c", fontSize: "1.1rem", marginBottom: 6 }}>{p.name}</div>
                <div style={{ fontSize: "0.8rem", color: "#444", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 12 }}>{p.title}</div>
                <div style={{ fontSize: "0.95rem", color: "#777", lineHeight: 1.75 }}>{p.text}</div>
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
