/**
 * Общие сведения о сайте и выставке. Один источник для метаданных,
 * карты сайта, микроразметки и самой страницы - чтобы даты площадок не
 * разъезжались между разметкой для поисковика и тем, что видит человек.
 */

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
 * Микроразметка Schema.org. Каждая площадка - отдельное ExhibitionEvent,
 * иначе поисковик не покажет карточку выставки с датами и адресом.
 */
export function buildJsonLd() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        url: SITE_URL,
        name: `${SITE_NAME} 2026`,
        description: SITE_DESCRIPTION,
        inLanguage: "ru-RU",
      },
      ...VENUES.map(v => ({
        "@type": "ExhibitionEvent",
        name: `${SITE_NAME} · ${v.name}`,
        description: SITE_DESCRIPTION,
        startDate: v.start,
        endDate: v.end,
        eventStatus: "https://schema.org/EventScheduled",
        eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
        image: `${SITE_URL}/og.jpg`,
        url: `${SITE_URL}/#venues`,
        location: {
          "@type": "Place",
          name: v.name,
          address: {
            "@type": "PostalAddress",
            streetAddress: v.streetAddress,
            addressLocality: "Москва",
            addressCountry: "RU",
          },
        },
        organizer: {
          "@type": "Organization",
          name: SITE_NAME,
          url: SITE_URL,
        },
      })),
    ],
  }
}
