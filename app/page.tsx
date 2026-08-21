import { fetchArtworks, fetchEvents } from "@/lib/airtable"
import Nav from "@/components/Nav"
import Gallery from "@/components/Gallery"
import CosmicDescent from "@/components/scenes/CosmicDescent"
import Reveal from "@/components/Reveal"
import DiveButton from "@/components/DiveButton"
import StatTile from "@/components/StatTile"

export const dynamic = 'force-dynamic'

const ESA_SOURCE = "ESA DISCOSweb, Space Debris Office"
const ESA_URL = "https://sdup.esoc.esa.int/discosweb/statistics/"
const ESA_DATE = "31 июля 2026"

const TELEMETRY: Array<{
  target?: number
  kind?: "count" | "millions" | "static"
  suffix?: string
  staticValue?: string
  label: string
  source: string
  sourceUrl: string
  asOf: string
  comparisons?: { label: string; value: string }[]
  trend?: string
}> = [
  {
    target: 46250,
    kind: "count",
    label: "каталогизированных объектов на орбите",
    source: ESA_SOURCE,
    sourceUrl: ESA_URL,
    asOf: ESA_DATE,
    trend: "NASA оценивала около 25 000 в 2022",
  },
  {
    target: 1200000,
    kind: "millions",
    label: "фрагментов крупнее сантиметра (оценка)",
    source: "ESA, модель MASTER-8",
    sourceUrl: "https://www.esa.int/Space_Safety/Space_Debris",
    asOf: "август 2024",
  },
  {
    target: 17000,
    kind: "count",
    suffix: "+ т",
    label: "суммарная масса металла на орбите",
    source: ESA_SOURCE,
    sourceUrl: ESA_URL,
    asOf: ESA_DATE,
    trend: "было ~9 000 т в январе 2022 (NASA)",
    comparisons: [
      { label: "≈ голубых китов", value: "113" },
      { label: "≈ Эйфелевых башен", value: "1,7" },
    ],
  },
  {
    staticValue: "7–8 км/с",
    label: "скорость обломка на низкой орбите",
    source: "NASA Orbital Debris Program Office",
    sourceUrl: "https://orbitaldebris.jsc.nasa.gov/faq/",
    asOf: "физическая константа орбиты",
  },
  {
    target: 4544,
    kind: "count",
    label: "спутников выведено на орбиту в 2025 году",
    source: "BryceTech, Orbital Launches Year in Review",
    sourceUrl: "https://brycetech.com/reports/report-documents/global-orbital-activity-2025/",
    asOf: "итоги 2025 года",
    trend: "+54% к 2024 году — мегасозвездия ускоряют темп",
  },
]

export default async function Home() {
  const [artworks, events] = await Promise.all([fetchArtworks(), fetchEvents()])
  const catalog = artworks.filter(a => a.inCatalog && a.imageUrl)

  return (
    <>
      <Nav />

      <CosmicDescent>
        {/* ── HERO (акт 1: тишина) ── */}
        <section style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", padding: "120px 24px 80px", textAlign: "center", position: "relative" }}>
          <div style={{ position: "relative", zIndex: 1, maxWidth: 800 }}>
            <div className="section-label" style={{ marginBottom: 24, fontSize: "0.9rem" }}>Выставочный проект · 2026</div>
            <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "clamp(2.6rem, 9vw, 5.5rem)", lineHeight: 1.05, letterSpacing: "0.02em", marginBottom: 28 }}>
              Космос больше<br />не пустота
            </h1>
            <div className="fade-line" style={{ maxWidth: 400, margin: "0 auto 28px" }} />
            <p style={{ color: "#aaa", fontSize: "1.1rem", letterSpacing: "0.03em", marginBottom: 48, maxWidth: 560, marginLeft: "auto", marginRight: "auto" }}>
              Выставочный проект об орбитальном мусоре и втором рождении материи.
              К 65-летию полёта Юрия Гагарина. Москва, весна 2026
            </p>
            <a href="#gallery" style={{ display: "inline-block", padding: "16px 48px", border: "1px solid #c9a84c", color: "#c9a84c", textDecoration: "none", fontSize: "0.85rem", letterSpacing: "0.3em", textTransform: "uppercase" }}>
              Смотреть галерею
            </a>
            <div>
              <DiveButton />
            </div>
          </div>
        </section>

        {/* ── ПЛОЩАДКИ (акт 7 начинается здесь визуально, данные требуют сверки) ── */}
        <section id="venues" style={{ padding: "80px 24px" }}>
          <div style={{ maxWidth: 1200, margin: "0 auto" }}>
            <div className="section-label" style={{ marginBottom: 8 }}>Площадки</div>
            <div className="fade-line" style={{ marginBottom: 48 }} />
            <Reveal className="grid-venues" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 2 }}>
              {[
                { name: "Галерея «Печатники»", dates: "6 марта — 19 апреля", address: "Москва, ул. Батюнинская, 14" },
                { name: "Музей «Спутник»", dates: "15 марта — 15 июня", address: "Москва, 2-я Рыбинская, 21, стр. 1" },
                { name: "Галерея «ART SPACE»", dates: "10 — 19 апреля", address: "Москва, Тверская, 9" },
                { name: "Офицерский клуб ВКС", dates: "10 — 19 апреля", address: "Москва, Павловская ул., 8" },
              ].map(v => (
                <div key={v.name} className="reveal-item" style={{ background: "#0d0d0d", border: "1px solid #1a1a1a", padding: "48px 40px", transition: "border-color 0.3s" }}>
                  <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.75rem", marginBottom: 16 }}>{v.name}</div>
                  <div style={{ color: "#c9a84c", fontSize: "1.15rem", marginBottom: 8 }}>{v.dates}</div>
                  <div style={{ color: "#777", fontSize: "1.05rem" }}>{v.address}</div>
                </div>
              ))}
            </Reveal>
          </div>
        </section>

        {/* ── О ПРОЕКТЕ (акт 2: плотность → акт 5: манифест) ── */}
        <section id="about" style={{ padding: "80px 24px" }}>
          <div style={{ maxWidth: 1200, margin: "0 auto" }}>
            <p style={{ fontFamily: "var(--font-display)", fontSize: "1.3rem", lineHeight: 1.7, color: "#ddd", maxWidth: 760, marginBottom: 40 }}>
              Мы привыкли думать, что там пустота. Чистый лист. Но пустота обрела плотность:
              она заполнена нашим присутствием, нашими амбициями, нашим холодным металлом.
            </p>
            <div className="grid-venues" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 1, marginBottom: 12 }}>
              {TELEMETRY.map(t => (
                <StatTile key={t.label} {...t} />
              ))}
            </div>
            <p style={{ color: "#444", fontSize: "0.72rem", marginBottom: 64 }}>
              Нажмите (i) на карточке — источник и дата. У массы мусора можно кликнуть по числу — сравнение для масштаба.
            </p>
          </div>
          <div className="grid-about" style={{ maxWidth: 1200, margin: "0 auto", display: "grid", gridTemplateColumns: "280px 1fr", gap: 80, alignItems: "start" }}>
            <div>
              <div className="section-label" style={{ marginBottom: 8 }}>О проекте</div>
              <div className="fade-line" />
            </div>
            <div>
              <p style={{ fontSize: "1.1rem", lineHeight: 1.85, color: "#999", marginBottom: 20 }}>
                Мусор на земле и мусор на орбите — одна и та же субстанция. Единый индустриальный
                след, который мы сначала вырвали из недр планеты, а затем забросили над своими головами.
              </p>
              <p style={{ fontSize: "1.05rem", lineHeight: 1.85, color: "#888", marginBottom: 20 }}>
                Космос забрал себе лучшее: чистый металл ушёл в обшивку ракет и электронику спутников.
                Внизу остались горы шлака, которые мы привыкли игнорировать. Я возвращаю этой материи
                право быть искусством. Этот метод называется артсайклинг: сгоревшие платы, вакуумные
                лампы, тумблеры великой эпохи очищаются от слоёв времени и пересобираются в новые смыслы.
              </p>
              <p style={{ fontSize: "1.05rem", lineHeight: 1.85, color: "#666" }}>
                Горы мусора на орбите — вызов нашему интеллекту и духу. Мы уже полноправные и
                ответственные жители Вселенной. Пора вести себя соответственно.
              </p>
            </div>
          </div>
        </section>
      </CosmicDescent>

      {/* ── ГАЛЕРЕЯ ── */}
      <Gallery artworks={catalog} />

      {/* ── КОМАНДА ── */}
      <section id="team" className="grain" style={{ padding: "80px 24px", position: "relative", background: "var(--earth-bg)" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div className="section-label" style={{ marginBottom: 8 }}>Участники</div>
          <div className="fade-line" style={{ marginBottom: 48 }} />
          <Reveal className="grid-team" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 1 }}>
            {[
              { name: "Сергей Кожуховский", role: "Экохудожник, автор идеи", desc: "Финалист премии президентской платформы «Россия – страна возможностей». Трансформирует техногенные отходы в художественные образы." },
              { name: "Елизавета Козырь", role: "Художник-монументалист", desc: "Реставратор, участвовала в восстановлении святынь храма Воскресения Христова в Иерусалиме." },
              { name: "Татьяна Кокорева", role: "Оперная певица, мастер прикладного искусства", desc: "Работает с материей небесных тел." },
              { name: "Варвара Хазова", role: "Видеохудожник", desc: "Автор документального исследования «Космический мусор»." },
              { name: "Татьяна Фатеева", role: "Фотограф и медиахудожник", desc: "Запечатлела красоту соприкосновения человека и звёзд." },
              { name: "Элина Папас", role: "Исполнительный продюсер", desc: "Куратор Арт-клуба Сколково, выпускница бизнес-школы Сколково и Лондонской школы бизнеса. Магистр РАНХиГС, программа «Управление в арт-бизнесе»." },
            ].map(p => (
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
          <div className="section-label" style={{ marginBottom: 8 }}>Партнёры</div>
          <div className="fade-line" style={{ marginBottom: 48 }} />
          <Reveal className="grid-partners" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 1 }}>
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
              <div key={p.name} className="reveal-item" style={{ padding: "28px 0", borderTop: "1px solid #1a1a1a" }}>
                <div style={{ fontSize: "1.1rem", color: "#c9a84c", marginBottom: 8 }}>{p.name}</div>
                {p.desc && <div style={{ fontSize: "1rem", color: "#666", lineHeight: 1.6 }}>{p.desc}</div>}
              </div>
            ))}
          </Reveal>
        </div>
      </section>

      {/* ── СОБЫТИЯ ── */}
      <section id="events" className="grain" style={{ padding: "80px 24px", borderTop: "1px solid #111", position: "relative", background: "var(--earth-bg)" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div className="section-label" style={{ marginBottom: 8 }}>Мероприятия и новости</div>
          <div className="fade-line" style={{ marginBottom: 48 }} />
          {events.length === 0 ? (
            <p style={{ color: "#444", fontSize: "0.9rem" }}>Мероприятия скоро появятся</p>
          ) : (
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
                        Подробнее →
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </Reveal>
          )}
        </div>
      </section>

      {/* ── ИСТОРИЯ ── */}
      <section id="history" className="grain" style={{ padding: "80px 24px", borderTop: "1px solid #111", position: "relative", background: "var(--earth-bg)" }}>
        <div className="grid-history-outer" style={{ maxWidth: 1200, margin: "0 auto", display: "grid", gridTemplateColumns: "280px 1fr", gap: 80, alignItems: "start" }}>
          <div>
            <div className="section-label" style={{ marginBottom: 8 }}>История проекта</div>
            <div className="fade-line" />
            <p style={{ marginTop: 24, fontSize: "0.95rem", color: "#555", lineHeight: 1.7 }}>
              «Экология космоса» выросла из слияния двух авторских взглядов на технологический след человечества.
            </p>
          </div>
          <Reveal>
            {[
              { year: "2018", text: "Монументальный художник Елизавета Козырь создала концептуальную серию работ, заложив визуальный фундамент темы." },
              { year: "2021", text: "Сергей Кожуховский, работая в ППК РЭО, создал первые объекты из электронных компонентов и дал проекту официальное название." },
              { year: "2022", text: "«Экология космоса» вышла в публичное пространство. Осенью проект представлен в инновационном центре «Ренова Лаб»." },
              { year: "2023", text: "Ключевая выставка в Калуге, в ГМИК им. К.\u00a0Э.\u00a0Циолковского. В рамках «Экософии» экспозиция прошла в Архангельске, Тюмени, Санкт-Петербурге, Нижнем Новгороде, Екатеринбурге и Челябинске." },
              { year: "2026", text: "Трансформируя промышленную археологию в искусство будущего, проект продолжает масштабировать смыслы на стыке экологии и космонавтики." },
            ].map((item, i) => (
              <div key={i} className="grid-history-row reveal-item" style={{ display: "grid", gridTemplateColumns: "72px 1fr", gap: 28, paddingBottom: 36, paddingTop: i === 0 ? 0 : 36, borderTop: i === 0 ? "none" : "1px solid #1a1a1a" }}>
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
          <div className="section-label" style={{ marginBottom: 8 }}>Благодарности</div>
          <div className="fade-line" style={{ marginBottom: 48 }} />
          <Reveal className="grid-thanks" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 1 }}>
            {[
              { name: "Мусс Павлу", title: "Генеральному директору «Принцип НОВО»", text: "За многолетнюю стратегическую поддержку проектов арт-группы «Осознанность» и личное участие в развитии нашей экосистемы." },
              { name: "Макарчук Ксении", title: "Президенту Арт-клуба «Сколково»", text: "За всестороннюю помощь, мощный информационный ресурс и участие в проектах арт-группы «Осознанность»." },
              { name: "Волковой Елене", title: "Руководителю издательства «Русский мир медиа»", text: "За безупречную организацию выставочных циклов в «Ренова Лаб» и ГМИК им. К.\u00a0Э.\u00a0Циолковского." },
              { name: "Абакумовой Наталье", title: "Директору ГМИК им. К.\u00a0Э.\u00a0Циолковского", text: "За проведение выставки и высокую экспертную оценку, результатом которой стала передача части работ в фонды музея и Государственный каталог РФ." },
              { name: "Щербакову Денису", title: "Основателю «Фестиваль-Строй»", text: "За профессиональную застройку экспозиций, предоставление выставочной инфраструктуры и активное партнёрство с 2022 года." },
              { name: "Беляеву Андрею", title: "Генеральному директору «Айфлекс»", text: "За надёжное партнёрство, проверенное годами, и неизменную поддержку наших инициатив." },
            ].map(p => (
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
          <span style={{ fontFamily: "var(--font-display)", color: "#c9a84c", fontSize: "0.9rem" }}>Экология Космоса 2026</span>
          <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
            <span style={{ color: "#5a5a5a", fontSize: "0.75rem" }}>Москва · Санкт-Петербург</span>
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
              разработка notevibe
            </a>
          </div>
        </div>
      </footer>

    </>
  )
}
