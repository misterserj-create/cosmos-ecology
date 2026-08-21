/**
 * Общие сведения о сайте и выставке. Один источник для метаданных,
 * карты сайта, микроразметки и самой страницы - чтобы даты площадок не
 * разъезжались между разметкой для поисковика и тем, что видит человек.
 */

import { defaultLocale, intlLocale, localePath, type Locale } from "@/i18n/config"

/** Основной адрес. Кириллический экологиякосмоса.рф ведёт сюда же. */
export const SITE_URL = "https://cosmosecology.ru"

export const SITE_NAME = "Экология Космоса"

export const SITE_DESCRIPTION =
  "Выставочный проект об орбитальном мусоре и втором рождении материи. " +
  "К 65-летию полёта Юрия Гагарина. Москва, весна 2026."

export type Venue = {
  /** Неизменяемый ключ. По нему берётся перевод названия, дат и адреса. */
  id: "pechatniki" | "sputnik" | "artspace" | "vks"
  name: string
  dates: string
  address: string
  /** Для микроразметки: даты в формате ISO. */
  start: string
  end: string
  streetAddress: string
  /** Площадка, где выставку можно увидеть прямо сейчас. */
  current?: boolean
  /** Сайт площадки: там расписание и билеты, мы их не дублируем. */
  url?: string
  note?: string
}

export const VENUES: Venue[] = [
  {
    id: "pechatniki",
    name: "Галерея «Печатники»",
    dates: "6 марта – 19 апреля",
    address: "Москва, ул. Батюнинская, 14",
    start: "2026-03-06",
    end: "2026-04-19",
    streetAddress: "ул. Батюнинская, 14",
  },
  {
    id: "sputnik",
    name: "Музей «Спутник»",
    dates: "15 марта – 15 июня",
    address: "Москва, 2-я Рыбинская, 21, стр. 1",
    start: "2026-03-15",
    end: "2026-06-15",
    streetAddress: "2-я Рыбинская ул., 21, стр. 1",
    current: true,
    url: "https://sputnikmuseum.ru/",
    note: "Вход по билетам музея. Расписание и билеты - на сайте «Спутника».",
  },
  {
    id: "artspace",
    name: "Галерея «ART SPACE»",
    dates: "10 – 19 апреля",
    address: "Москва, Тверская, 9",
    start: "2026-04-10",
    end: "2026-04-19",
    streetAddress: "Тверская ул., 9",
  },
  {
    id: "vks",
    name: "Офицерский клуб ВКС",
    dates: "10 – 19 апреля",
    address: "Москва, Павловская ул., 8",
    start: "2026-04-10",
    end: "2026-04-19",
    streetAddress: "Павловская ул., 8",
  },
]

/**
 * Цифры "Акта 02: Плотность". Здесь только то, что переводу не подлежит:
 * само число, вид форматирования, название источника и ссылка на него.
 * Подписи, дата "по состоянию на" и сравнения живут в словарях по ключу id.
 */
export type TelemetryId = "objects" | "fragments" | "mass" | "speed" | "launches"

export type TelemetryItem = {
  id: TelemetryId
  target?: number
  kind?: "count" | "millions" | "static"
  source: string
  sourceUrl: string
}

const ESA_SOURCE = "ESA DISCOSweb, Space Debris Office"
const ESA_URL = "https://sdup.esoc.esa.int/discosweb/statistics/"

export const TELEMETRY: TelemetryItem[] = [
  { id: "objects", target: 46250, kind: "count", source: ESA_SOURCE, sourceUrl: ESA_URL },
  {
    id: "fragments",
    target: 1200000,
    kind: "millions",
    source: "ESA, модель MASTER-8",
    sourceUrl: "https://www.esa.int/Space_Safety/Space_Debris",
  },
  { id: "mass", target: 17000, kind: "count", source: ESA_SOURCE, sourceUrl: ESA_URL },
  {
    id: "speed",
    source: "NASA Orbital Debris Program Office",
    sourceUrl: "https://orbitaldebris.jsc.nasa.gov/faq/",
  },
  {
    id: "launches",
    target: 4544,
    kind: "count",
    source: "BryceTech, Orbital Launches Year in Review",
    sourceUrl: "https://brycetech.com/reports/report-documents/global-orbital-activity-2025/",
  },
]

/**
 * Фильтр галереи. Подпись кнопки переводится, а сравнение идёт по полю
 * `match` - это значение поля "автор" в базе, оно не переводится никогда.
 * Иначе на английской версии фильтр перестал бы находить работы.
 */
export type AuthorFilter = { id: "all" | "kozhukhovsky" | "kozyr" | "kokoreva"; match: string | null }

export const AUTHOR_FILTERS: AuthorFilter[] = [
  { id: "all", match: null },
  { id: "kozhukhovsky", match: "Сергей Кожуховский" },
  { id: "kozyr", match: "Елизавета Козырь" },
  { id: "kokoreva", match: "Татьяна Кокорева" },
]

/** Города на глобусе: координаты - данные, подпись - перевод по ключу id. */
export const SCENE_CITIES = [
  { id: "moscow" as const, lat: 55.75, lon: 37.62 },
  { id: "spb" as const, lat: 59.94, lon: 30.31 },
]

/**
 * Перечисления из базы: техника, статус, категория работы и тип события.
 *
 * Значений на всю базу десяток, и в таблицу переводов им не место: слово
 * «Артсайклинг» стоит у 49 работ из 84, и переводить его сорок девять раз
 * незачем. Ключ - русское значение как оно лежит в базе; чего в словаре нет,
 * то показывается по-русски.
 */
type EnumDictionary = Record<string, Partial<Record<Locale, string>>>

/** Техника. Фактический список значений на 21.08.2026 - 12 штук. */
export const TECHNIQUE_LABELS: EnumDictionary = {
  "Артсайклинг": {
    en: "Artcycling", es: "Artciclaje", zh: "艺术再生",
    fr: "Artcyclage", de: "Artcycling", ja: "アートサイクリング",
  },
  "Ассамбляж": {
    en: "Assemblage", es: "Ensamblaje", zh: "集合艺术",
    fr: "Assemblage", de: "Assemblage", ja: "アッサンブラージュ",
  },
  "Ассамбляж, артсайклинг": {
    en: "Assemblage, artcycling", es: "Ensamblaje, artciclaje", zh: "集合艺术、艺术再生",
    fr: "Assemblage, artcyclage", de: "Assemblage, Artcycling", ja: "アッサンブラージュ、アートサイクリング",
  },
  "Артсайклинг, ассамбляж": {
    en: "Artcycling, assemblage", es: "Artciclaje, ensamblaje", zh: "艺术再生、集合艺术",
    fr: "Artcyclage, assemblage", de: "Artcycling, Assemblage", ja: "アートサイクリング、アッサンブラージュ",
  },
  "Артсайклинг, смешанная техника": {
    en: "Artcycling, mixed media", es: "Artciclaje, técnica mixta", zh: "艺术再生、综合媒材",
    fr: "Artcyclage, technique mixte", de: "Artcycling, Mischtechnik", ja: "アートサイクリング、ミクストメディア",
  },
  "Артсайклинг (картон, полимеры, фольга, плёнка, проволока)": {
    en: "Artcycling (cardboard, polymers, foil, film, wire)",
    es: "Artciclaje (cartón, polímeros, papel de aluminio, película, alambre)",
    zh: "艺术再生（纸板、聚合物、箔、薄膜、金属丝）",
    fr: "Artcyclage (carton, polymères, feuille métallique, film, fil de fer)",
    de: "Artcycling (Karton, Polymere, Folie, Film, Draht)",
    ja: "アートサイクリング（段ボール、ポリマー、箔、フィルム、針金）",
  },
  "Холст, акрил": {
    en: "Acrylic on canvas", es: "Acrílico sobre lienzo", zh: "布面丙烯",
    fr: "Acrylique sur toile", de: "Acryl auf Leinwand", ja: "キャンバスにアクリル",
  },
  "Холст, темпера": {
    en: "Tempera on canvas", es: "Temple sobre lienzo", zh: "布面坦培拉",
    fr: "Tempera sur toile", de: "Tempera auf Leinwand", ja: "キャンバスにテンペラ",
  },
  "Холст, смешанная техника (акрил, пена, целлюлоза)": {
    en: "Mixed media on canvas (acrylic, foam, cellulose)",
    es: "Técnica mixta sobre lienzo (acrílico, espuma, celulosa)",
    zh: "布面综合媒材（丙烯、泡沫、纤维素）",
    fr: "Technique mixte sur toile (acrylique, mousse, cellulose)",
    de: "Mischtechnik auf Leinwand (Acryl, Schaumstoff, Zellulose)",
    ja: "キャンバスにミクストメディア（アクリル、フォーム、セルロース）",
  },
  "Эпоксидная смола, гипс, пластик, провода": {
    en: "Epoxy resin, plaster, plastic, wires",
    es: "Resina epoxi, yeso, plástico, cables",
    zh: "环氧树脂、石膏、塑料、电线",
    fr: "Résine époxy, plâtre, plastique, fils",
    de: "Epoxidharz, Gips, Kunststoff, Kabel",
    ja: "エポキシ樹脂、石膏、プラスチック、配線",
  },
  "Ручная сборка": {
    en: "Hand assembly", es: "Montaje manual", zh: "手工组装",
    fr: "Assemblage manuel", de: "Handmontage", ja: "手作業による組立",
  },
  "Гобелен, шпалера, стенной ковёр": {
    en: "Tapestry, woven hanging, wall carpet",
    es: "Tapiz, colgadura tejida, alfombra de pared",
    zh: "挂毯、编织壁挂、壁毯",
    fr: "Tapisserie, tenture tissée, tapis mural",
    de: "Gobelin, gewebter Wandbehang, Wandteppich",
    ja: "タペストリー、織壁掛け、壁掛け絨毯",
  },
}

/** Статус работы. Четыре значения. На витрине пока не показывается, но в админке виден. */
export const STATUS_LABELS: EnumDictionary = {
  "В экспозиции Спутник": {
    en: "On display at the Sputnik Museum",
    es: "En exposición en el Museo Sputnik",
    zh: "在“斯普特尼克”博物馆展出",
    fr: "Exposée au musée Spoutnik",
    de: "Ausgestellt im Sputnik-Museum",
    ja: "スプートニク博物館で展示中",
  },
  "В наличии (Москва)": {
    en: "Available (Moscow)", es: "Disponible (Moscú)", zh: "现有（莫斯科）",
    fr: "Disponible (Moscou)", de: "Verfügbar (Moskau)", ja: "在庫あり（モスクワ）",
  },
  "Направляется на выставку ЭК": {
    en: "In transit to the Cosmos Ecology exhibition",
    es: "En camino a la exposición Ecología del Cosmos",
    zh: "运往“宇宙生态”展览",
    fr: "En route vers l’exposition Écologie du Cosmos",
    de: "Unterwegs zur Ausstellung Ökologie des Kosmos",
    ja: "「宇宙のエコロジー」展へ輸送中",
  },
  "Продана": {
    en: "Sold", es: "Vendida", zh: "已售出",
    fr: "Vendue", de: "Verkauft", ja: "売約済み",
  },
}

/** Категория работы. Три значения. */
export const CATEGORY_LABELS: EnumDictionary = {
  "Ассамбляж (настенный)": {
    en: "Assemblage (wall-mounted)", es: "Ensamblaje (de pared)", zh: "集合艺术（壁挂）",
    fr: "Assemblage (mural)", de: "Assemblage (Wandobjekt)", ja: "アッサンブラージュ（壁掛け）",
  },
  "Кабинетная серия": {
    en: "Cabinet series", es: "Serie de gabinete", zh: "小型陈设系列",
    fr: "Série de cabinet", de: "Kabinettserie", ja: "小品シリーズ",
  },
  "Живопись": {
    en: "Painting", es: "Pintura", zh: "绘画",
    fr: "Peinture", de: "Malerei", ja: "絵画",
  },
}

/** Тип события. Два значения, оба видны на витрине над карточкой. */
export const EVENT_TYPE_LABELS: EnumDictionary = {
  "Мероприятие": {
    en: "Event", es: "Evento", zh: "活动",
    fr: "Événement", de: "Veranstaltung", ja: "イベント",
  },
  "Новость": {
    en: "News", es: "Noticia", zh: "新闻",
    fr: "Actualité", de: "Nachricht", ja: "ニュース",
  },
}

/**
 * Подпись перечисления на нужном языке. Русский отдаётся как есть, чужого
 * значения в словаре нет - тоже отдаём как есть: новая техника появится в
 * базе раньше, чем её перевод, и лучше показать её по-русски, чем пустоту.
 */
export function enumLabel(dict: EnumDictionary, value: string, locale: Locale): string {
  const raw = (value || "").trim()
  if (!raw || locale === defaultLocale) return value || ""
  return dict[raw]?.[locale] || value
}

/** Город на глобусе и в почтовом адресе разметки. */
const MOSCOW: Record<Locale, string> = {
  ru: "Москва",
  en: "Moscow",
  es: "Moscú",
  zh: "莫斯科",
  fr: "Moscou",
  de: "Moskau",
  ja: "モスクワ",
}

/**
 * Тексты микроразметки, которые приходят из словаря языка. Название и
 * описание проекта, названия площадок - всё это уже переведено для самой
 * страницы, и дублировать переводы ради разметки незачем.
 */
export type JsonLdContent = {
  siteName?: string
  description?: string
  venueNames?: Partial<Record<Venue["id"], string>>
}

/**
 * Микроразметка Schema.org. Каждая площадка - отдельное ExhibitionEvent,
 * иначе поисковик не покажет карточку выставки с датами и адресом.
 *
 * Собирается по языку страницы: inLanguage, названия площадок, город.
 * Улица и страна остаются как есть - почтовый адрес не переводят, по нему
 * ходит курьер и строит маршрут карта.
 */
export function buildJsonLd(locale: Locale = defaultLocale, content: JsonLdContent = {}) {
  const siteName = content.siteName || SITE_NAME
  const description = content.description || SITE_DESCRIPTION
  const pageUrl = `${SITE_URL}${localePath(locale) === "/" ? "" : localePath(locale)}`

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        url: pageUrl,
        name: `${siteName} 2026`,
        description,
        inLanguage: intlLocale[locale],
      },
      ...VENUES.map(v => {
        const venueName = content.venueNames?.[v.id] || v.name
        return {
          "@type": "ExhibitionEvent",
          name: `${siteName} · ${venueName}`,
          description,
          inLanguage: intlLocale[locale],
          startDate: v.start,
          endDate: v.end,
          eventStatus: "https://schema.org/EventScheduled",
          eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
          image: `${SITE_URL}/og.jpg`,
          url: `${pageUrl}/#venues`,
          location: {
            "@type": "Place",
            name: venueName,
            address: {
              "@type": "PostalAddress",
              streetAddress: v.streetAddress,
              addressLocality: MOSCOW[locale],
              addressCountry: "RU",
            },
          },
          organizer: {
            "@type": "Organization",
            name: siteName,
            url: SITE_URL,
          },
        }
      }),
    ],
  }
}
