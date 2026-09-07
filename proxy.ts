import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { defaultLocale, isLocale } from '@/i18n/config'

function hash(s: string) {
  return createHash('sha256').update(s).digest('hex')
}

/**
 * Одна функция на два дела, потому что файл может быть только один.
 * Порядок важен и менять его нельзя:
 *
 *   1. Админка. Всё, что начинается с /admin, проходит проверку входа и
 *      сразу возвращается. Языковая ветка до /admin не добирается.
 *   2. Служебные адреса (/api, /_next, файлы с расширением) пропускаются
 *      как есть - у них нет и не должно быть языкового префикса.
 *   3. Язык. Корень "/" отдаёт русскую страницу внутренней подменой
 *      адреса на /ru: адрес в браузере остаётся прежним, проиндексированная
 *      главная никуда не переезжает. Явный /ru убирается переадресацией,
 *      чтобы одна и та же страница не жила по двум адресам.
 */
/**
 * Совпадает ли печенье с паролем из окружения.
 *
 * Запасного пароля нет намеренно: если ADMIN_PASSWORD не задан, вход не
 * пускает никого. Раньше здесь стояло значение по умолчанию, и на боевом
 * сервере оно же и работало, то есть админка была открыта всем, кто читал
 * исходники публичного репозитория.
 */
function passes(req: NextRequest): boolean {
  const secret = process.env.ADMIN_PASSWORD
  if (!secret) return false
  return req.cookies.get('admin_token')?.value === hash(secret)
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl

  // 1. Админка
  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    if (pathname === '/admin/login') return NextResponse.next()
    if (!passes(req)) return NextResponse.redirect(new URL('/admin/login', req.url))
    return NextResponse.next()
  }

  // 1а. Административное API. Проверка входа стоит здесь, а не в каждом
  //     маршруте: маршрутов 20, обёртку в своё время получили только 9, и
  //     остальные вместе с их PUT и DELETE были открыты наружу.
  if (pathname.startsWith('/api/admin')) {
    if (pathname === '/api/admin/login') return NextResponse.next()
    if (!passes(req)) {
      return NextResponse.json({ error: 'нет доступа' }, { status: 401 })
    }
    return NextResponse.next()
  }

  // 2. Служебное: запросы к API, внутренние адреса Next и файлы (og.jpg,
  //    robots.txt, sitemap.xml, текстуры). Языку тут делать нечего.
  if (
    pathname.startsWith('/api') ||
    pathname.startsWith('/_next') ||
    pathname.includes('.')
  ) {
    return NextResponse.next()
  }

  // 3. Язык
  const segment = pathname.split('/')[1] ?? ''

  //    /ru и /ru/... - тот же контент, что и без префикса. Убираем префикс
  //    переадресацией. Подмена адреса из строки ниже сюда не возвращается:
  //    внутренний rewrite не запускает proxy заново.
  if (segment === defaultLocale) {
    const url = req.nextUrl.clone()
    url.pathname = pathname.slice(defaultLocale.length + 1) || '/'
    return NextResponse.redirect(url, 308)
  }

  //    Язык уже указан явно (/en, /ja/...) - отдаём как есть.
  if (isLocale(segment)) return NextResponse.next()

  //    Всё остальное, включая корень, - русская версия без префикса.
  const url = req.nextUrl.clone()
  url.pathname = `/${defaultLocale}${pathname === '/' ? '' : pathname}`
  return NextResponse.rewrite(url)
}

export const config = {
  // Служебные адреса отсекаются ещё до входа в функцию, чтобы на каждую
  // картинку и файл шрифта не тратить вызов.
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
