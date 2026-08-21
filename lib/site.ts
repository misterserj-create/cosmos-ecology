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
    name: "Галерея «Печатники»",
    dates: "6 марта – 19 апреля",
    address: "Москва, ул. Батюнинская, 14",
    start: "2026-03-06",
    end: "2026-04-19",
    streetAddress: "ул. Батюнинская, 14",
  },
  {
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
    name: "Галерея «ART SPACE»",
    dates: "10 – 19 апреля",
    address: "Москва, Тверская, 9",
    start: "2026-04-10",
    end: "2026-04-19",
    streetAddress: "Тверская ул., 9",
  },
  {
    name: "Офицерский клуб ВКС",
    dates: "10 – 19 апреля",
    address: "Москва, Павловская ул., 8",
    start: "2026-04-10",
    end: "2026-04-19",
    streetAddress: "Павловская ул., 8",
  },
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
